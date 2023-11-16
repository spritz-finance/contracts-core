// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SpritzBridgeReceiver
 * @author Spritz Finance
 * @notice A utility contract for handling bridged funds
 */
contract SpritzBridgeReceiver is AccessControlEnumerable {
    using SafeERC20 for IERC20;

    // @dev Bot which has permission to call the bridge function
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // @dev Address of paraswap
    address internal _target = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;
    // @dev Address of paraswap allowance target
    address internal _allowanceTarget = 0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    // @dev Circle receiving address
    address internal _circleReceiving = 0xb0E2D41a14494717f42Ffc6327F9D250b0ad32a8;

    constructor(address bridgeRole) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, bridgeRole);
    }

    /**
     * @dev Bridge deposited tokens via Jumper
     * @param fromToken Token to swap
     * @param amount How much to swap
     * @param toToken Target token
     * @param swapData Data for paraswap call
     */
    function swapToken(
        address fromToken,
        uint amount,
        address toToken,
        bytes calldata swapData
    ) external payable onlyRole(BRIDGE_ROLE) {
        require(amount <= IERC20(fromToken).balanceOf(address(this)), "Amount exceeds balance");
        IERC20(fromToken).safeApprove(_allowanceTarget, amount);
        _target.call{ value: msg.value }(swapData);
        IERC20(toToken).transfer(_circleReceiving, IERC20(toToken).balanceOf(address(this)));
    }

    /**
     * @dev Withdraw deposited tokens to the given address
     * @param token Token to withdraw
     * @param to Target address
     */
    function sweep(IERC20 token, address to) external onlyRole(BRIDGE_ROLE) {
        token.transfer(to, token.balanceOf(address(this)));
    }

    /**
     * @dev Withdraw ETH to the given address
     * @param to Target address
     */
    function nativeSweep(address to) external onlyRole(BRIDGE_ROLE) {
        to.call{ value: address(this).balance }("");
    }
}
