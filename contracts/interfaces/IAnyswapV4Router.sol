// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;


/// @title Interface for AnyswapV4Router
interface IAnyswapV4Router {
    function anySwapOut(address, address, uint, uint) external;
    function anySwapOutUnderlying(address, address, uint, uint) external;
}
