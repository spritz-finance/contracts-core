// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.21;

interface ITokenTransferProxy {
    function transfer(address paymentTokenAddress, address from, address to, uint256 amount) external;

    function transferWithPermit(
        address tokenAddress,
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
