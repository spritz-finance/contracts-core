// SPDX-License-Identifier: UNLICENSED

import "openzeppelin-5/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-5/token/ERC20/extensions/IERC20Permit.sol";
import "openzeppelin-5/token/ERC20/IERC20.sol";

pragma solidity ^0.8.21;

contract TokenTransferProxy {
    function transfer(address paymentTokenAddress, address from, address to, uint256 amount) external {
        IERC20(paymentTokenAddress).transferFrom(from, to, amount);
    }

    function transferWithPermit(
        address tokenAddress,
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IERC20Permit(tokenAddress).permit(from, address(this), amount, deadline, v, r, s);
        IERC20(tokenAddress).transferFrom(from, to, amount);
    }
}
