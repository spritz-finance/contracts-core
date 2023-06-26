// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SpritzPayV3 } from "../SpritzPayV3.sol";

contract SpritzReceiver {
    error InsufficientBalance();
    error NotController();

    event EtherReceived(address indexed sender, uint256 value);

    bytes32 private immutable accountReference;
    address private immutable spritzPay;
    address private immutable controller;

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    constructor(address _controller, address _spritzPay, bytes32 _accountReference) payable {
        controller = _controller;
        spritzPay = _spritzPay;
        accountReference = _accountReference;
    }

    function payWithToken(IERC20 token, uint256 amount) external onlyController {
        if (token.balanceOf(address(this)) < amount) revert InsufficientBalance();
        ensureSpritzPayAllowance(token);
        SpritzPayV3(spritzPay).payWithToken(address(token), amount, accountReference);
    }

    function payWithNativeSwap(
        uint256 amount,
        uint256 inputTokenAmount,
        uint256 deadline,
        bytes calldata swapData
    ) external onlyController {
        if (address(this).balance < inputTokenAmount) revert InsufficientBalance();
        SpritzPayV3(spritzPay).payWithNativeSwap{ value: inputTokenAmount }(
            amount,
            accountReference,
            deadline,
            swapData
        );
    }

    function payWithSwap(
        address sourceTokenAddress,
        uint256 sourceTokenAmountMax,
        uint256 paymentTokenAmount,
        uint256 deadline,
        bytes calldata swapData
    ) external onlyController {
        if (IERC20(sourceTokenAddress).balanceOf(address(this)) < sourceTokenAmountMax) revert InsufficientBalance();
        ensureSpritzPayAllowance(IERC20(sourceTokenAddress));
        SpritzPayV3(spritzPay).payWithSwap(
            sourceTokenAddress,
            sourceTokenAmountMax,
            paymentTokenAmount,
            accountReference,
            deadline,
            swapData
        );
    }

    function ensureSpritzPayAllowance(IERC20 token) internal {
        uint256 allowance = token.allowance(address(this), spritzPay);

        if (allowance == 0) {
            token.approve(spritzPay, type(uint256).max);
        }
    }

    /**
     * @dev Withdraw deposited tokens to the given address
     * @param token Token to withdraw
     * @param to Target address
     */
    function sweep(IERC20 token, address to) external onlyController {
        token.transfer(to, token.balanceOf(address(this)));
    }

    receive() external payable {
        if (msg.value > 0) emit EtherReceived(msg.sender, msg.value);
    }
}
