// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IAnyswapV4Router.sol";

/**
 * @title SpritzBridge
 * @author Spritz Finance
 * @notice A utility contract for facilitating bridging received funds via Multichain
 */
contract SpritzBridge is AccessControlEnumerable  {

    using SafeERC20 for IERC20;

    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    /// @notice The address of the multichain bridge contract
    address internal immutable BRIDGE_ADDRESS;

    constructor(address bridgeAddress) {
        BRIDGE_ADDRESS = bridgeAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WITHDRAW_ROLE, msg.sender);
    }

    /**
     * @dev Bridge received tokens to the given address on the given chain
     * @param token Token to withdraw
     * @param swapToken Which facilitates the trade
     * @param to Target address
     * @param chainId ID of target chain
     */
    function bridge(IERC20 token, IERC20 swapToken, address to, uint amount, uint chainId) external onlyRole(WITHDRAW_ROLE) {
        token.safeApprove(BRIDGE_ADDRESS, type(uint256).max);
        IAnyswapV4Router(BRIDGE_ADDRESS).anySwapOutUnderlying(address(swapToken), to, amount, chainId);
    }

    /**
     * @dev Withdraw received tokens to the given address
     * @param token Token to withdraw
     * @param to Target address
     */
    function sweep(IERC20 token, address to) external onlyRole(WITHDRAW_ROLE) {
        token.transfer(to, token.balanceOf(address(this)));
    }

}
