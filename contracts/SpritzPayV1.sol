// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "./lib/SpritzPayStorage.sol";
import "./lib/SafeERC20.sol";

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
    Initializable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    ReentrancyGuardUpgradeable,
    SpritzPayStorage
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

    /**
     * @dev Constructor for upgradable contract
     */
    function initialize(
        address _admin,
        address _paymentRecipient,
        address _swapTarget,
        address _wrappedNative
    ) public virtual initializer {
        __SpritzPayStorage_init(_admin, _paymentRecipient, _swapTarget, _wrappedNative);
        __Pausable_init();
        __AccessControlEnumerable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @notice Pay by direct stablecoin transfer
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Payment amount, denominated in target payment token
     * @param paymentReference Arbitrary reference ID of the related payment
     */
    function payWithToken(
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) external whenNotPaused {
        emit Payment(
            _paymentRecipient,
            _msgSender(),
            paymentTokenAddress,
            paymentTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        bool transferSuccess = safeTransferToken(
            paymentTokenAddress,
            _msgSender(),
            _paymentRecipient,
            paymentTokenAmount
        );
        if (!transferSuccess) {
            revert FailedTokenTransfer({
                tokenAddress: paymentTokenAddress,
                to: _paymentRecipient,
                amount: paymentTokenAmount
            });
        }
    }

    /**
     * @notice Pay by swapping token or with native currency, using uniswapv2 as swap provider. Uses
     *          Uniswap exact output trade type
     * @param path Swap path
     * @param sourceTokenAmountMax Maximum amount of the token being sold for payment
     * @param paymentTokenAmount Exact Amount of the target payment token
     * @param paymentReference Arbitrary reference ID of the related payment
     * @param deadline Swap deadline
     */
    function payWithSwap(
        address[] calldata path,
        uint256 sourceTokenAmountMax,
        uint256 paymentTokenAmount,
        bytes32 paymentReference,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant {
        address sourceTokenAddress = path[0];
        address paymentTokenAddress = path[path.length - 1];
        IERC20 sourceToken = IERC20(sourceTokenAddress);
        IUniswapV2Router02 router = IUniswapV2Router02(_swapTarget);
        bool isNativeSwap = sourceTokenAddress == _wrappedNative;

        // If swap involves non-native token, transfer token in, and grant allowance to
        // the swap router
        if (!isNativeSwap) {
            //Ensure our contract gives sufficient allowance to swap target
            if (sourceToken.allowance(address(this), _swapTarget) < sourceTokenAmountMax) {
                bool approveSuccess = approveTokenSpend(sourceTokenAddress, _swapTarget);
                require(approveSuccess, "Could not approve swapTarget");
            }

            //Transfer from user to our contract
            bool transferInSuccess = safeTransferToken(
                sourceTokenAddress,
                _msgSender(),
                address(this),
                sourceTokenAmountMax
            );

            if (!transferInSuccess) {
                revert FailedTokenTransfer({
                    tokenAddress: sourceTokenAddress,
                    to: address(this),
                    amount: sourceTokenAmountMax
                });
            }
        }

        uint256[] memory amounts;

        //Execute the swap
        if (!isNativeSwap) {
            amounts = router.swapTokensForExactTokens(
                paymentTokenAmount,
                sourceTokenAmountMax,
                path,
                _paymentRecipient,
                deadline
            );
        } else {
            amounts = router.swapETHForExactTokens{ value: msg.value }(
                paymentTokenAmount,
                path,
                _paymentRecipient,
                deadline
            );
        }

        uint256 sourceTokenSpentAmount = amounts[0];

        require(amounts[amounts.length - 1] == paymentTokenAmount, "Swap did not yield declared payment amount");

        emit Payment(
            _paymentRecipient,
            _msgSender(),
            sourceTokenAddress,
            sourceTokenSpentAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        //Refund remaining balance left after the swap to the user
        uint256 remainingBalance = sourceTokenAmountMax - sourceTokenSpentAmount;
        if (remainingBalance > 0) {
            bool refundSuccess = isNativeSwap
                ? payable(_msgSender()).send(remainingBalance)
                : sourceToken.safeTransfer(_msgSender(), remainingBalance);

            if (!refundSuccess) {
                revert FailedRefund({ tokenAddress: sourceTokenAddress, amount: remainingBalance });
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

    /*
     * Admin functions
     */

    receive() external payable {}

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setPaymentRecipient(address newPaymentRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPaymentRecipient(newPaymentRecipient);
    }
}
