// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { SpritzReceiver } from "./SpritzReceiver.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract SpritzReceiverFactory is AccessControlEnumerable {
    event ReceiverDeployed(address indexed receiver);

    bytes public constant CREATION_CODE = type(SpritzReceiver).creationCode;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DEPLOYER_ROLE, msg.sender);
    }

    function deploy(address controller, address spritzPay, bytes32 accountReference) external onlyRole(DEPLOYER_ROLE) {
        bytes memory encodedArgs = abi.encode(controller, spritzPay, accountReference);

        address receiver = Create2.deploy(0, keccak256(encodedArgs), abi.encodePacked(CREATION_CODE, encodedArgs));

        emit ReceiverDeployed(receiver);
    }
}
