// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SafeERC20
 * @notice Works around implementations of ERC20 with transferFrom not returning success status.
 */
library SafeERC20 {
    /**
     * @notice Call transferFrom ERC20 function and validates the return data of a ERC20 contract call.
     * @dev This is necessary because of non-standard ERC20 tokens that don't have a return value.
     * @return result The return value of the ERC20 call, returning true for non-standard tokens
     */
    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool result) {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );

        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    /**
     * @notice Call approve ERC20 function and validates the return data of a ERC20 contract call.
     * @dev This is necessary because of non-standard ERC20 tokens that don't have a return value.
     * @return result The return value of the ERC20 call, returning true for non-standard tokens
     */
    function safeApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal returns (bool result) {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );

        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    /**
     * @notice Call transfer ERC20 function and validates the return data of a ERC20 contract call.
     * @dev This is necessary because of non-standard ERC20 tokens that don't have a return value.
     * @return result The return value of the ERC20 call, returning true for non-standard tokens
     */
    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) internal returns (bool result) {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );

        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}
