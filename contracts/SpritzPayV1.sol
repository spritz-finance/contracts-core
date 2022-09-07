// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

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
     * @notice Pay by swapping token or with native currency, using 0x as dex aggregator
     * @param sourceTokenAddress Address of the token being sold for payment
     * @param sourceTokenAmount Amount of the token being sold for payment
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Amount of the target payment token
     * @param swapCallData The `data` field from the 0x API response.
     * @param paymentReference Reference of the payment related
     */
    function payWithSwap(
        address sourceTokenAddress,
        uint256 sourceTokenAmount,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes calldata swapCallData,
        bytes32 paymentReference
    ) external payable whenNotPaused nonReentrant {
        bool isNativeSwap = sourceTokenAddress == address(0);
        IERC20 sourceToken = IERC20(sourceTokenAddress);
        IERC20 paymentToken = IERC20(paymentTokenAddress);

        console.log(
            "start balances: source-%s, payment-%s, native-%s",
            isNativeSwap ? 0 : sourceToken.balanceOf(address(this)),
            paymentToken.balanceOf(address(this)),
            address(this).balance
        );

        // If swap involves non-native token
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

        console.log(
            "before swap contract balances: source-%s, payment-%s, native-%s",
            isNativeSwap ? 0 : sourceToken.balanceOf(address(this)),
            paymentToken.balanceOf(address(this)),
            address(this).balance
        );

        //Call 0x swap
        (bool swapSuccess, ) = swapTarget.call{ value: msg.value }(swapCallData);
        if (!swapSuccess) {
            revert FailedSwap({
                sourceTokenAddress: sourceTokenAddress,
                sourceTokenAmount: sourceTokenAmount,
                paymentTokenAddress: paymentTokenAddress,
                paymentTokenAmount: paymentTokenAmount
            });
        }

        console.log(
            "after swap contract balances: source-%s, payment-%s, native-%s",
            isNativeSwap ? 0 : sourceToken.balanceOf(address(this)),
            paymentToken.balanceOf(address(this)),
            address(this).balance
        );

        //Transfer payment token to declared destination
        bool transferOutSuccess = paymentToken.safeTransfer(paymentRecipient, paymentTokenAmount);
        if (!transferOutSuccess) {
            revert FailedTokenTransfer({
                tokenAddress: paymentTokenAddress,
                to: paymentRecipient,
                amount: paymentTokenAmount
            });
        }

        console.log(
            "after transfer out balances: source-%s, payment-%s, native-%s",
            isNativeSwap ? 0 : sourceToken.balanceOf(address(this)),
            paymentToken.balanceOf(address(this)),
            address(this).balance
        );

        //Refund any remaining payment token balance to user
        {
            uint256 remainingPaymentTokenBalance = paymentToken.balanceOf(address(this));
            if (remainingPaymentTokenBalance > 0) {
                //Refund any remaining payment token to user
                bool refundPaymentTokenSuccess = paymentToken.transfer(_msgSender(), remainingPaymentTokenBalance);
                if (!refundPaymentTokenSuccess) {
                    revert FailedRefund({ tokenAddress: paymentTokenAddress, amount: remainingPaymentTokenBalance });
                }
            }
        }

        //Refund any remaining source token balance to user
        //        uint256 remainingBalance = 0;

        //Refund remaining source token to caller
        if (!isNativeSwap && sourceToken.balanceOf(address(this)) > 0) {
            uint256 remainingBalance = sourceToken.balanceOf(address(this));
            bool refundSourceTokenSuccess = sourceToken.transfer(_msgSender(), remainingBalance);
            if (!refundSourceTokenSuccess) {
                revert FailedRefund({ tokenAddress: sourceTokenAddress, amount: remainingBalance });
            }
        }

        if (address(this).balance > 0) {
            //slither-disable-next-line arbitrary-send
            payable(_msgSender()).transfer(address(this).balance);
        }

        console.log(
            "after refunds: source-%s, payment-%s, native-%s",
            isNativeSwap ? 0 : sourceToken.balanceOf(address(this)),
            paymentToken.balanceOf(address(this)),
            address(this).balance
        );

        logPayment(sourceTokenAddress, sourceTokenAmount, paymentTokenAddress, paymentTokenAmount, paymentReference);
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

    // Payable fallback to handle receiving protocol fee refunds from 0x.
    receive() external payable {}

    /*
     * Admin functions
     */

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
