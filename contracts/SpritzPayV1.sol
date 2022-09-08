// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./lib/SpritzPayStorage.sol";
import "./lib/SafeERC20.sol";
import "hardhat/console.sol";

error FailedTokenTransfer(address tokenAddress, address to, uint256 amount);
error FailedSwap(
    address sourceTokenAddress,
    uint256 sourceTokenAmount,
    address paymentTokenAddress,
    uint256 paymentTokenAmount
);
error FailedRefund(address tokenAddress, uint256 amount);

/**
 * @title SpritzPayV1
 * @notice Main entry point for Spritz payments
 */
contract SpritzPayV1 is
    SpritzPayStorage,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @dev Emitted when a payment has been sent
     */
    event Payment(
        address to,
        address indexed from,
        address indexed sourceToken,
        uint256 sourceTokenAmount,
        address paymentToken,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    );

    function initialize(address _paymentRecipient, address _swapTarget) public virtual initializer {
        _setPaymentRecipient(_paymentRecipient);
        _setSwapTarget(_swapTarget);
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @notice Pay by direct stablecoin transfer
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Payment amount, denominated in target payment token
     * @param paymentReference Reference of the related payment
     */
    function payWithToken(
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) external whenNotPaused {
        logPayment(paymentTokenAddress, paymentTokenAmount, paymentTokenAddress, paymentTokenAmount, paymentReference);

        bool transferSuccess = safeTransferToken(
            paymentTokenAddress,
            _msgSender(),
            paymentRecipient,
            paymentTokenAmount
        );
        if (!transferSuccess) {
            revert FailedTokenTransfer({
                tokenAddress: paymentTokenAddress,
                to: paymentRecipient,
                amount: paymentTokenAmount
            });
        }
    }

    /**
     * @notice Pay by swapping token or with native currency, using uniswapv2 as swap provider.
     * @param sourceTokenAddress Address of the token being sold for payment
     * @param sourceTokenAmount Max Amount of the token being sold for payment
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Exact Amount of the target payment token
     * @param paymentReference Reference of the payment related
     */
    function payWithSwap(
        address sourceTokenAddress,
        uint256 sourceTokenAmount,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) external payable whenNotPaused nonReentrant {
        bool isNativeSwap = sourceTokenAddress == 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;

        IERC20 sourceToken = IERC20(sourceTokenAddress);
        IERC20 paymentToken = IERC20(paymentTokenAddress);
        IUniswapV2Router02 router = IUniswapV2Router02(swapTarget);

        // If swap involves non-native token, transfer token in, and grant allowance to
        // the swap router
        if (!isNativeSwap) {
            //Ensure our contract gives sufficient allowance to swap target
            if (sourceToken.allowance(address(this), swapTarget) < sourceTokenAmount) {
                bool approveSuccess = approveTokenSpend(sourceTokenAddress, swapTarget);
                require(approveSuccess, "Could not approve swapTarget");
            }

            //Transfer from user to our contract
            bool transferInSuccess = safeTransferToken(
                sourceTokenAddress,
                _msgSender(),
                address(this),
                sourceTokenAmount
            );

            if (!transferInSuccess) {
                revert FailedTokenTransfer({
                    tokenAddress: sourceTokenAddress,
                    to: address(this),
                    amount: sourceTokenAmount
                });
            }
        }

        address[] memory path = new address[](2);
        path[0] = sourceTokenAddress;
        path[1] = paymentTokenAddress;

        uint256[] memory amounts;

        //Execute the swap
        if (!isNativeSwap) {
            amounts = router.swapTokensForExactTokens(
                paymentTokenAmount,
                sourceTokenAmount,
                path,
                paymentRecipient,
                block.timestamp
            );
        } else {
            amounts = router.swapETHForExactTokens{ value: msg.value }(
                paymentTokenAmount,
                path,
                paymentRecipient,
                block.timestamp
            );
        }

        uint256 sourceTokenSpentAmount = amounts[0];

        logPayment(
            sourceTokenAddress,
            sourceTokenSpentAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        //Refund remaining balance left after the swap to the user

        uint256 remainingBalance = sourceTokenAmount - sourceTokenSpentAmount;
        if (remainingBalance > 0) {
            if (isNativeSwap) {
                bool sent = payable(_msgSender()).send(remainingBalance);
                require(sent, "Failed to send Ether");
            } else {
                bool refundSourceTokenSuccess = sourceToken.safeTransfer(_msgSender(), remainingBalance);
                if (!refundSourceTokenSuccess) {
                    revert FailedRefund({ tokenAddress: sourceTokenAddress, amount: remainingBalance });
                }
            }
        }
    }

    /**
     * @notice Authorizes the swap router to spend a token
     * @param token Address of an ERC20 token
     * @param allowanceTarget Target contract which can spend this contract's token balance
     */
    function approveTokenSpend(address token, address allowanceTarget) private returns (bool approveSuccess) {
        IERC20 erc20 = IERC20(token);
        uint256 max = 2**256 - 1;
        return erc20.safeApprove(allowanceTarget, max);
    }

    /**
     * @notice Transfers token to
     * @param token Address of an ERC20 used for payment
     * @param from Address from which to withdraw
     * @param to Address which receives token
     * @param amount Amount to withdraw
     */
    function safeTransferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool transferSuccess) {
        IERC20 erc20 = IERC20(token);
        return erc20.safeTransferFrom(from, to, amount);
    }

    function logPayment(
        address sourceTokenAddress,
        uint256 sourceTokenAmount,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) internal {
        emit Payment(
            paymentRecipient,
            _msgSender(),
            sourceTokenAddress,
            sourceTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );
    }

    /*
     * Admin functions
     */

    receive() external payable {}

    fallback() external payable {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPaymentRecipient(address newPaymentRecipient) external onlyOwner {
        _setPaymentRecipient(newPaymentRecipient);
    }
}
