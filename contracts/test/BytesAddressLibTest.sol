// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "../lib/BytesAddressLib.sol";

contract BytesAddressLibTest {
    function toAddressArray(bytes memory _bytes) external pure returns (address[] memory) {
        return BytesAddressLib.toAddressArray(_bytes);
    }

    function getFirstAddress(bytes memory _bytes) external pure returns (address) {
        return BytesAddressLib.parseFirstAddress(_bytes);
    }

    function getLastAddress(bytes memory _bytes) external pure returns (address) {
        return BytesAddressLib.parseLastAddress(_bytes);
    }
}
