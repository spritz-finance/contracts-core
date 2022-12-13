// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("FakeCoin", "FAKE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
