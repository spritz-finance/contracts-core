// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import { SpritzSmartPayHarness } from "./harnesses/SpritzSmartPayHarness.sol";

// forge test --match-contract EIP712
contract EIP712Test is Test {
    bytes32 private constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256(bytes("SpritzSmartPay"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));

    SpritzSmartPayHarness smartPay;

    function setUp() public {
        smartPay = new SpritzSmartPayHarness();
    }

    function testDomainSeparator() public {
        bytes32 expectedDomainSeparator = keccak256(
            abi.encode(TYPE_HASH, NAME_HASH, VERSION_HASH, block.chainid, address(smartPay))
        );
        assertEq(smartPay.DOMAIN_SEPARATOR(), expectedDomainSeparator);
    }

    function testDomainSeparatorAfterFork() public {
        bytes32 beginningSeparator = smartPay.DOMAIN_SEPARATOR();
        uint256 newChainId = block.chainid + 1;
        vm.chainId(newChainId);
        assertTrue(smartPay.DOMAIN_SEPARATOR() != beginningSeparator);

        bytes32 expectedDomainSeparator = keccak256(
            abi.encode(TYPE_HASH, NAME_HASH, VERSION_HASH, block.chainid, address(smartPay))
        );
        assertEq(smartPay.DOMAIN_SEPARATOR(), expectedDomainSeparator);
    }
}
