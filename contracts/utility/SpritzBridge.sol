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
contract SpritzBridge is AccessControlEnumerable {

    using SafeERC20 for IERC20;

    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    address internal immutable BRIDGE_ADDRESS = 0xd1C5966f9F5Ee6881Ff6b261BBeDa45972B1B5f3;
    IERC20 USDC = IERC20(0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d);
    address internal immutable USDC_POLYGON_ANYTOKEN = 0x8965349fb649A33a30cbFDa057D8eC2C48AbE2A2;
    address internal immutable RECEIVING_ADDRESS = 0x4b7D6C3cEa01F4d54A9cad6587DA106Ea39dA1e6;
    uint minimum = 12 * (10**18);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WITHDRAW_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, msg.sender);
    }

    /**
     * @dev Bridge received USDC to Polygon
     * @param amount Amount to bridge
     */
    function bridgeUDSCToPolygon(uint amount) external onlyRole(BRIDGE_ROLE) {
        require(amount <= USDC.balanceOf(address(this)), "Amount exceeds balance");
        require(amount > minimum, "Amount less than minimum");

        USDC.safeApprove(BRIDGE_ADDRESS, amount);
        IAnyswapV4Router(BRIDGE_ADDRESS).anySwapOutUnderlying(
            USDC_POLYGON_ANYTOKEN,
            RECEIVING_ADDRESS,
            amount,
            137
        );
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
