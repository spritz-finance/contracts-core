// SPDX-License-Identifier: UNLICENSED

import { ISpritzPayCore } from "./interfaces/ISpritzPayCore.sol";
import "openzeppelin-5/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-5/token/ERC20/IERC20.sol";

pragma solidity ^0.8.21;

contract SpritzPayRouter {
    using SafeERC20 for IERC20;

    ISpritzPayCore public immutable spritzPay;

    constructor(address _spritzPay) payable {
        spritzPay = ISpritzPayCore(_spritzPay);
    }

    function getTokenTransferProxy() external view returns (address) {
        return address(this);
    }

    /**
     * @notice Pay by direct stablecoin transfer
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Payment amount, denominated in target payment token
     * @param paymentReference Arbitrary reference ID of the related payment
     */
    function payWithToken(address paymentTokenAddress, uint256 paymentTokenAmount, bytes32 paymentReference) external {
        IERC20(paymentTokenAddress).safeTransferFrom(msg.sender, address(this), paymentTokenAmount);
        spritzPay.pay(
            msg.sender,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );
    }
}
