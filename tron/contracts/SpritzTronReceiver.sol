// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


interface ICurvePool {
    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 _dx,
        uint256 _min_dy
    )
    external;

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    )
    external
    view
    returns (uint256);

    // Add additional functions as necessary
    // For example, to check the balance of a particular token:
    function balances(
        int128 i
    )
    external
    view
    returns (uint256);
}


/**
 * @title SpritzBridgeV2
 * @author Spritz Finance
 * @notice A utility contract for facilitating offloading USDT to USDC
 */
contract SpritzTronReceiver is AccessControlEnumerable {

    using SafeERC20 for IERC20;

    // @dev Bot which has permission to call the bridge function
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // @dev Admin which can withdraw deposited tokens without bridging
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    IERC20 usdt;
    IERC20 usdc;

    ICurvePool public curvePool;
    int128 public usdtIndex;
    int128 public usdcIndex;

    constructor(
        address _usdt,
        address _usdc,

        address _curvePool,
        int128 _usdtIndex,
        int128 _usdcIndex
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WITHDRAW_ROLE, msg.sender);
        _setupRole(BRIDGE_ROLE, msg.sender);

        usdt = IERC20(_usdt);
        usdc = IERC20(_usdc);

        curvePool = ICurvePool(_curvePool);
        usdtIndex = _usdtIndex;
        usdcIndex = _usdcIndex;
    }

    /**
     * @dev Set the curve pool parameters
     * @param _curvePool Address of USDT/USDC Curve pool
     * @param _usdtIndex Index of usdt
     * @param _usdcIndex Index of usdc
     */
    function setCurvePool(address _curvePool, int128 _usdtIndex, int128 _usdcIndex) external onlyRole(DEFAULT_ADMIN_ROLE) {
        curvePool = ICurvePool(_curvePool);
        usdtIndex = _usdtIndex;
        usdcIndex = _usdcIndex;
    }


    /**
     * @dev Exchange USDT to USDC and send back
     */
    function exchange() public onlyRole(BRIDGE_ROLE) {
        uint256 usdtBalance = usdt.balanceOf(address(this));
        require(usdtBalance > 0, "No USDT to exchange");

        usdt.approve(address(curvePool), usdtBalance);

        // Calculate minimum USDC balance to accept (99.5% of expected)
        uint256 expected_dy = curvePool.get_dy_underlying(usdtIndex, usdcIndex, usdtBalance);
        uint256 min_dy = expected_dy * 995 / 1000;

        // Perform the exchange
        curvePool.exchange_underlying(usdtIndex, usdcIndex, usdtBalance, min_dy);

        // Transfer back the received USDC
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance > 0, "No USDC to transfer");
        usdc.transfer(msg.sender, usdcBalance);
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
