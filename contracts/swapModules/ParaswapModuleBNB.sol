// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/SwapModule.sol";
import "../interfaces/IWETH9.sol";
import { IParaSwapAugustusRegistry } from "../interfaces/IParaSwapAugustusRegistry.sol";
import { IParaSwapAugustus } from "../interfaces/IParaSwapAugustus.sol";

pragma solidity ^0.8.7;

contract ParaswapModuleBNB is SwapModule {
    using SafeERC20 for IERC20;

    error FailedRefund();
    error InvalidNativeSwap();
    error InvalidSwapTarget();
    error InsufficientInputBalance();
    error InvalidSwapBalance();
    error InvalidSwapOutput();

    IWETH9 public immutable weth;
    address public immutable augustusSwapper;

    constructor(address _swapper, IWETH9 _weth) {
        augustusSwapper = _swapper;
        weth = _weth;
    }

    /**
     * Decode the swap data that will be passed to the swap router
     * @param swapData the bytes swap data to be decoded
     * @return inputTokenAddress the address of the input token to be swapped
     * @return outputTokenAddress the address of the output token
     */
    function decodeSwapData(
        bytes calldata swapData
    ) external pure override returns (address inputTokenAddress, address outputTokenAddress) {
        return _decodeSwapData(swapData);
    }

    /**
     * @notice performs an exact output swap using native ETH and refunds the leftover ETH to the user
     * @param swapParams the parameters required to make the swap (See: SwapModule.ExactOutputParams)
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     */
    function exactOutputNativeSwap(ExactOutputParams calldata swapParams) external payable override returns (uint256) {
        weth.deposit{ value: swapParams.inputTokenAmountMax }();

        (
            IERC20 inputTokenAddress,
            IERC20 outputToken,
            uint256 inputTokenAmountSpent,
            uint256 remainingBalance
        ) = _exactOutputSwap(swapParams);

        if (address(inputTokenAddress) != address(weth)) revert InvalidNativeSwap();

        outputToken.safeTransfer(swapParams.to, swapParams.paymentTokenAmount);

        // refund leftover tokens to original caller if there are any
        if (remainingBalance > 0) {
            weth.withdraw(remainingBalance);
            (bool success, ) = swapParams.from.call{ value: remainingBalance }("");
            if (!success) revert FailedRefund();
        }

        return inputTokenAmountSpent;
    }

    /**
     * @notice performs an exact output swap using an ERC-20 token and refunds leftover tokens to the user
     * @param swapParams the parameters required to make the swap (See: SwapModule.ExactOutputParams)
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     */
    function exactOutputSwap(ExactOutputParams calldata swapParams) public override returns (uint256) {
        (
            IERC20 inputToken,
            IERC20 outputToken,
            uint256 inputTokenAmountSpent,
            uint256 remainingBalance
        ) = _exactOutputSwap(swapParams);

        outputToken.safeTransfer(swapParams.to, swapParams.paymentTokenAmount);

        // refund leftover tokens to original caller if there are any
        if (remainingBalance > 0) {
            inputToken.safeTransfer(swapParams.from, remainingBalance);
        }

        return inputTokenAmountSpent;
    }

    /**
     * @notice private method to perform an exact output swap on the augustus router
     * @param swapParams the parameters required to make the swap (See: SwapModule.ExactOutputParams)
     * @return inputTokenAddress the address of the token being swapped
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     * @return remainingBalance the leftover balance of the input token after the swap
     */
    function _exactOutputSwap(
        ExactOutputParams calldata swapParams
    ) private returns (IERC20, IERC20, uint256, uint256) {
        (bytes memory paraswapCalldata, address augustus, IERC20 inputToken, IERC20 outputToken) = abi.decode(
            swapParams.swapData,
            (bytes, address, IERC20, IERC20)
        );

        if (augustusSwapper != augustus) revert InvalidSwapTarget();

        uint256 balanceBeforeInputToken = inputToken.balanceOf(address(this));
        if (balanceBeforeInputToken < swapParams.inputTokenAmountMax) revert InsufficientInputBalance();

        uint256 balanceBeforeOutputToken = outputToken.balanceOf(address(this));

        _swap(augustus, inputToken, swapParams.inputTokenAmountMax, paraswapCalldata);

        uint256 amountReceived = outputToken.balanceOf(address(this)) - balanceBeforeOutputToken;
        if (amountReceived < swapParams.paymentTokenAmount) revert InvalidSwapOutput();

        uint256 balanceAfterInputToken = inputToken.balanceOf(address(this));
        uint256 inputTokenAmountSpent = balanceBeforeInputToken - balanceAfterInputToken;
        if (inputTokenAmountSpent > swapParams.inputTokenAmountMax) revert InvalidSwapBalance();

        return (inputToken, outputToken, inputTokenAmountSpent, balanceAfterInputToken);
    }

    function _swap(address augustus, IERC20 inputToken, uint256 inputTokenAmountMax, bytes memory data) internal {
        address tokenTransferProxy = IParaSwapAugustus(augustus).getTokenTransferProxy();

        uint256 allowance = inputToken.allowance(address(this), tokenTransferProxy);

        if (allowance == 0) {
            inputToken.safeApprove(tokenTransferProxy, type(uint256).max);
        } else if (allowance < inputTokenAmountMax) {
            inputToken.safeApprove(tokenTransferProxy, 0);
            inputToken.safeApprove(tokenTransferProxy, type(uint256).max);
        }

        (bool success, ) = address(augustus).call(data);
        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    /**
     * @notice decode the input token and output token from the v3 swapData
     * @param swapData the uniswap v3 path
     * @dev v3 path is the encoded swap path and pool fees in *reverse* order (output token -> input token)
     * @return inputTokenAddress the address of the token being swapped
     * @return outputTokenAddress the address of the token being swapped to
     */
    function _decodeSwapData(
        bytes calldata swapData
    ) private pure returns (address inputTokenAddress, address outputTokenAddress) {
        (, , inputTokenAddress, outputTokenAddress) = abi.decode(swapData, (bytes, address, address, address));
    }

    receive() external payable {}
}
