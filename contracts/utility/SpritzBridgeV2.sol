// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SpritzBridgeV2
 * @author Spritz Finance
 * @notice A utility contract for facilitating bridging received funds via Jumper
 */
contract SpritzBridgeV2 is AccessControlEnumerable {

    using SafeERC20 for IERC20;

    // @dev Bot which has permission to call the bridge function
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // @dev Admin which can withdraw deposited tokens without bridging
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    // @dev Address of LiFiDiamond contract
    address internal _bridgeTarget;

    event BridgeConfigured(
        address bridge
    );

    constructor(address withdrawRole, address bridgeRole, address bridgeAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WITHDRAW_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, msg.sender);

        _setupRole(WITHDRAW_ROLE, withdrawRole);
        _setupRole(BRIDGE_ROLE, bridgeRole);
        _setBridgeTarget(bridgeAddress);

    }

    /**
     * @dev Sets a new address for the bridge target
     */
    function _setBridgeTarget(address newBridgeTarget) internal {
        _bridgeTarget = newBridgeTarget;
        emit BridgeConfigured(_bridgeTarget);
    }

    /**
     * @dev Returns the address of the bridge target
     */
    function bridgeTarget() public view returns (address) {
        return _bridgeTarget;
    }

    /**
     * @dev Set the bridging address
     * @param bridge LiFiDiamond location
     */
    function setBridgeTarget(
        address bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBridgeTarget(bridge);
    }

    /**
     * @dev Bridge deposited tokens via Jumper
     * @param token Token to send to bridge
     * @param amount How much to bridge
     * @param bridgeCallData Data for the jumper contract
     */
    function bridgeToken(address token, uint amount, bytes calldata bridgeCallData) external onlyRole(BRIDGE_ROLE) payable {
        require(amount <= IERC20(token).balanceOf(address(this)), "Amount exceeds balance");
        IERC20(token).safeApprove(_bridgeTarget, 0);
        IERC20(token).safeApprove(_bridgeTarget, amount);
        _bridgeTarget.call{value: msg.value}(bridgeCallData);
    }

    /**
     * @dev Withdraw deposited tokens to the given address
     * @param token Token to withdraw
     * @param to Target address
     */
    function sweep(IERC20 token, address to) external onlyRole(WITHDRAW_ROLE) {
        token.transfer(to, token.balanceOf(address(this)));
    }

}
