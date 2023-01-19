// SPDX-License-Identifier: UNLICENSED

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/ISpritzSwapModule.sol";
import "../lib/BytesAddressLib.sol";

pragma solidity ^0.8.7;

contract SpritzV2SwapModule is ISpritzSwapModule {
    using BytesAddressLib for bytes;
    using SafeERC20 for IERC20;

    error FailedRefund();

    address public immutable weth;
    address public immutable swapTarget;

    constructor(address _swapTarget, address _weth) {
        swapTarget = _swapTarget;
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
        (, inputTokenAddress, outputTokenAddress) = _decodeSwapData(swapData);
    }

    /**
     * @notice performs an exact output swap using native ETH and refunds the leftover ETH to the user
     * @param swapParams the parameters required to make the swap (See: ISpritzSwapModule.ExactOutputParams)
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     */
    function exactOutputNativeSwap(ExactOutputParams calldata swapParams) external payable override returns (uint256) {
        IWETH9(weth).deposit{ value: swapParams.inputTokenAmountMax }();

        (, uint256 inputTokenAmountSpent, uint256 remainingBalance) = _exactOutputSwap(swapParams);

        // refund leftover tokens to original caller if there are any
        if (remainingBalance > 0) {
            IWETH9(weth).withdraw(remainingBalance);
            (bool success, ) = swapParams.from.call{ value: remainingBalance }("");
            if (!success) revert FailedRefund();
        }

        return inputTokenAmountSpent;
    }

    /**
     * @notice performs an exact output swap using an ERC-20 token and refunds leftover tokens to the user
     * @param swapParams the parameters required to make the swap (See: ISpritzSwapModule.ExactOutputParams)
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     */
    function exactOutputSwap(ExactOutputParams calldata swapParams) public override returns (uint256) {
        (address inputTokenAddress, uint256 inputTokenAmountSpent, uint256 remainingBalance) = _exactOutputSwap(
            swapParams
        );

        // refund leftover tokens to original caller if there are any
        if (remainingBalance > 0) {
            IERC20(inputTokenAddress).safeTransfer(swapParams.from, remainingBalance);
        }

        return inputTokenAmountSpent;
    }

    /**
     * @notice private method to perform an exact output swap on the v2 router
     * @param swapParams the parameters required to make the swap (See: ISpritzSwapModule.ExactOutputParams)
     * @return inputTokenAddress the address of the token being swapped
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     * @return remainingBalance the leftover balance of the input token after the swap
     */
    function _exactOutputSwap(ExactOutputParams calldata swapParams) private returns (address, uint256, uint256) {
        (address[] memory path, address inputTokenAddress, ) = _decodeSwapData(swapParams.swapData);

        IERC20 inputToken = IERC20(inputTokenAddress);

        uint256 allowance = inputToken.allowance(address(this), swapTarget);
        if (allowance < swapParams.inputTokenAmountMax) {
            inputToken.approve(swapTarget, type(uint256).max);
        }

        (uint256 inputTokenAmountSpent, uint256 remainingBalance) = _swap(swapParams, path);

        return (inputTokenAddress, inputTokenAmountSpent, remainingBalance);
    }

    /**
     * @notice internal method to handle the underlying swap with the v2 router
     * @param swapParams the parameters required to make the swap (See: ISpritzSwapModule.ExactOutputParams)
     * @param path an array of addresses referring to the swap path
     * @return inputTokenAmountSpent the amount of the input token spent to facilitate the swap
     * @return remainingBalance the leftover balance of the input token after the swap
     */
    function _swap(
        ExactOutputParams calldata swapParams,
        address[] memory path
    ) private returns (uint256 inputTokenAmountSpent, uint256 remainingBalance) {
        IUniswapV2Router02 router = IUniswapV2Router02(swapTarget);

        uint256[] memory amounts = router.swapTokensForExactTokens(
            swapParams.paymentTokenAmount,
            swapParams.inputTokenAmountMax,
            path,
            swapParams.to,
            swapParams.deadline
        );

        inputTokenAmountSpent = amounts[0];
        remainingBalance = swapParams.inputTokenAmountMax - inputTokenAmountSpent;
    }

    /**
     * @notice decode the bytes string containing the data for the swap
     * @param swapData the data to be decoded, a packed address string containing the v2 swap path
     * @return path the array of addresses containing the swap path
     * @return inputTokenAddress the address of the token being swapped
     * @return outputTokenAddress the address of the token being swapped to
     */
    function _decodeSwapData(bytes calldata swapData) private pure returns (address[] memory, address, address) {
        address[] memory decodedPaths = swapData.toAddressArray();
        return (decodedPaths, decodedPaths[0], decodedPaths[decodedPaths.length - 1]);
    }
}
