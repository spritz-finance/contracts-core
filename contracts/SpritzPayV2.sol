// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/IWETH9.sol";

import "./lib/SpritzPayStorageV2.sol";

/**
 * @title SpritzPayV2
 * @notice Main entry point for Spritz payments
 */
contract SpritzPayV2 is
    Initializable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    ReentrancyGuardUpgradeable,
    SpritzPayStorageV2
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 private constant MAX_UINT = 2 ** 256 - 1;

    error FailedRefund(address tokenAddress, uint256 amount);

    error InsufficientValue(uint256 required, uint256 amount);

    error V2RouterNotConfigured();

    error V3RouterNotConfigured();

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
        bytes32 indexed paymentReference
    );

    /**
     * @dev Constructor for upgradable contract
     */
    function initialize(
        address _admin,
        address _paymentRecipient,
        address _swapTarget,
        address _wrappedNative,
        address[] calldata _acceptedTokens
    ) public virtual initializer {
        __SpritzPayStorage_init(_admin, _paymentRecipient, _swapTarget, _wrappedNative, _acceptedTokens);
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
    ) external whenNotPaused onlyAcceptedToken(paymentTokenAddress) {
        emit Payment(
            _paymentRecipient,
            msg.sender,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        IERC20Upgradeable(paymentTokenAddress).safeTransferFrom(msg.sender, _paymentRecipient, paymentTokenAmount);
    }

    /**
     * @notice Pay by direct stablecoin transfer from SmartPay subscription contract
     * @param payee Address of account initiating the payment
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Payment amount, denominated in target payment token
     * @param paymentReference Arbitrary reference ID of the related payment
     */
    function payWithTokenSubscription(
        address payee,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) external whenNotPaused onlySmartPay {
        emit Payment(
            _paymentRecipient,
            payee,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        IERC20Upgradeable(paymentTokenAddress).safeTransferFrom(msg.sender, _paymentRecipient, paymentTokenAmount);
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
        if (_swapTarget == address(0)) revert V2RouterNotConfigured();

        address sourceTokenAddress = path[0];
        address paymentTokenAddress = path[path.length - 1];

        if (!isAcceptedToken(paymentTokenAddress)) {
            revert NonAcceptedToken(paymentTokenAddress);
        }

        IERC20Upgradeable sourceToken = IERC20Upgradeable(sourceTokenAddress);
        bool isNativeSwap = sourceTokenAddress == _wrappedNative && msg.value > 0;

        // If swap involves non-native token, transfer token in, and grant allowance to
        // the swap router
        if (!isNativeSwap) {
            //Ensure our contract gives sufficient allowance to swap target
            uint256 allowance = sourceToken.allowance(address(this), _swapTarget);
            if (allowance < sourceTokenAmountMax) {
                uint256 allowanceIncrease;
                unchecked {
                    allowanceIncrease = MAX_UINT - allowance;
                }
                sourceToken.safeIncreaseAllowance(_swapTarget, allowanceIncrease);
            }

            //Transfer from user to our contract
            sourceToken.safeTransferFrom(msg.sender, address(this), sourceTokenAmountMax);
        }

        uint256[] memory amounts;

        {
            //Execute the swap
            IUniswapV2Router02 router = IUniswapV2Router02(_swapTarget);
            if (!isNativeSwap) {
                amounts = router.swapTokensForExactTokens(
                    paymentTokenAmount,
                    sourceTokenAmountMax,
                    path,
                    _paymentRecipient,
                    deadline
                );
            } else {
                if (msg.value < sourceTokenAmountMax) revert InsufficientValue(sourceTokenAmountMax, msg.value);
                amounts = router.swapETHForExactTokens{ value: msg.value }(
                    paymentTokenAmount,
                    path,
                    _paymentRecipient,
                    deadline
                );
            }
        }

        uint256 sourceTokenSpentAmount = amounts[0];

        emit Payment(
            _paymentRecipient,
            msg.sender,
            sourceTokenAddress,
            sourceTokenSpentAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );

        //Refund remaining balance left after the swap to the user
        uint256 remainingBalance = sourceTokenAmountMax - sourceTokenSpentAmount;
        if (remainingBalance > 0) {
            if (isNativeSwap) {
                (bool success, ) = msg.sender.call{ value: remainingBalance }("");
                if (!success) revert FailedRefund(sourceTokenAddress, remainingBalance);
            } else {
                sourceToken.safeTransfer(msg.sender, remainingBalance);
            }
        }
    }

    /**
     * @notice Pay by swapping token or with native currency, using uniswapv3 as swap provider. Uses
     *          Uniswap exact output trade type
     * @param path The encoded path of the trade
     * @param sourceTokenAddress The address of the input token being swapped
     * @param sourceTokenAmountMax Maximum amount of the token being sold for payment
     * @param paymentTokenAddress The address of the payment token
     * @param paymentTokenAmount Exact Amount of the target payment token
     * @param paymentReference Arbitrary reference ID of the related payment
     * @param deadline Swap deadline
     */
    function payWithV3Swap(
        bytes calldata path,
        address sourceTokenAddress,
        uint256 sourceTokenAmountMax,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant {
        if (_v3SwapTarget == address(0)) revert V3RouterNotConfigured();
        if (!isAcceptedToken(paymentTokenAddress)) {
            revert NonAcceptedToken(paymentTokenAddress);
        }

        bool isNativeSwap = sourceTokenAddress == _wrappedNative && msg.value > 0;
        IERC20Upgradeable sourceToken = IERC20Upgradeable(sourceTokenAddress);

        if (isNativeSwap) {
            if (msg.value < sourceTokenAmountMax) revert InsufficientValue(sourceTokenAmountMax, msg.value);
            // Wrap Ether
            IWETH9(sourceTokenAddress).deposit{ value: sourceTokenAmountMax }();
        } else {
            //Transfer from user to our contract
            sourceToken.safeTransferFrom(msg.sender, address(this), sourceTokenAmountMax);
        }

        //Ensure our contract gives sufficient allowance to swap target
        sourceToken.safeIncreaseAllowance(_v3SwapTarget, sourceTokenAmountMax);

        uint256 sourceTokenSpent;
        {
            ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
                path: path,
                recipient: _paymentRecipient,
                deadline: deadline,
                amountOut: paymentTokenAmount,
                amountInMaximum: sourceTokenAmountMax
            });

            ISwapRouter swapRouter = ISwapRouter(_v3SwapTarget);
            sourceTokenSpent = swapRouter.exactOutput(params);
        }
        uint256 remainingBalance = sourceTokenAmountMax - sourceTokenSpent;

        // reset swap router allowance
        sourceToken.safeApprove(_v3SwapTarget, 0);

        if (remainingBalance > 0) {
            if (isNativeSwap) {
                IWETH9(sourceTokenAddress).withdraw(remainingBalance);
                (bool success, ) = msg.sender.call{ value: remainingBalance }("");
                if (!success) revert FailedRefund(sourceTokenAddress, remainingBalance);
            } else {
                sourceToken.safeTransfer(msg.sender, remainingBalance);
            }
        }

        emit Payment(
            _paymentRecipient,
            msg.sender,
            sourceTokenAddress,
            sourceTokenSpent,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );
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

    function setV3SwapTarget(address newSwapTarget) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setV3SwapTarget(newSwapTarget);
    }

    function setSmartPayAddress(address swapPayAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setSmartPay(swapPayAddress);
    }

    function addPaymentToken(address newToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addPaymentToken(newToken);
    }

    function removePaymentToken(address newToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removePaymentToken(newToken);
    }
}
