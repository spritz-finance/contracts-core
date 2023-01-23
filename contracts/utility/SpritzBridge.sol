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

    // @dev Bot which has permission to call the bridge function
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // @dev Admin which can withdraw deposited tokens without bridging
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");


    event BridgeParamsConfigured(
        address indexed token,
        uint targetChain,
        address bridge,
        address anyToken,
        uint minimum,
        address receiver,
        bool isUnderlying
    );

    /**
     * @dev Configuration for bridging a particular token
     * @param token The token being bridged
     * @param targetChain ID of chain
     * @param bridge AnyswapV4Router location
     * @param anyToken Address of anytoken facilitating swap
     * @param minimum Minimum swap amount
     * @param receiver Receiving address on target chain
     * @param isUnderlying Whether we use anySwapOutUnderlying or anySwapOut
     */
    struct BridgeParams {
        address token;
        uint targetChain;
        address bridge;
        address anyToken;
        uint minimum;
        address receiver;
        bool isUnderlying;
    }

    mapping(address => BridgeParams) tokenBridgingParams;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WITHDRAW_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, msg.sender);
    }


    /**
     * @dev Set the bridging parameters for the given token
     * @param token The token being bridged
     * @param targetChain ID of chain
     * @param bridge AnyswapV4Router location
     * @param anyToken Address of anytoken facilitating swap
     * @param minimum Minimum swap amount
     * @param receiver Receiving address on target chain
     * @param isUnderlying Whether we use anySwapOutUnderlying or anySwapOut
     */
    function setBridgeParamsForToken(
        address token,
        uint targetChain,
        address bridge,
        address anyToken,
        uint minimum,
        address receiver,
        bool isUnderlying
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenBridgingParams[token] = BridgeParams(
            token,
            targetChain,
            bridge,
            anyToken,
            minimum,
            receiver,
            isUnderlying
        );

        emit BridgeParamsConfigured(
            token,
            targetChain,
            bridge,
            anyToken,
            minimum,
            receiver,
            isUnderlying
        );
    }

    /**
     * @dev Bridge deposited tokens via Multichain
     * @param token Token to send to bridge
     * @param amount How much to bridge
     */
    function bridgeToken(address token, uint amount) external onlyRole(BRIDGE_ROLE) {
        BridgeParams storage params = tokenBridgingParams[token];
        require(params.token != address(0), "Bridging params not found");

        require(amount <= IERC20(params.token).balanceOf(address(this)), "Amount exceeds balance");
        require(amount >= params.minimum, "Amount less than minimum");
        IERC20(params.token).safeApprove(params.bridge, amount);
        if(params.isUnderlying) {
            IAnyswapV4Router(params.bridge).anySwapOutUnderlying(
                params.anyToken,
                params.receiver,
                amount,
                params.targetChain
            );
        } else {
            IAnyswapV4Router(params.bridge).anySwapOut(
                params.anyToken,
                params.receiver,
                amount,
                params.targetChain
            );
        }

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
