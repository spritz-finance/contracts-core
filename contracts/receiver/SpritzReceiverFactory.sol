// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { SpritzReceiver } from "./SpritzReceiver.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

/**
 * @title SpritzReceiverFactory
 * @dev This contract acts as a factory for deploying SpritzReceiver instances using CREATE2.
 */
contract SpritzReceiverFactory is AccessControlEnumerable {
    event ReceiverDeployed(address indexed receiver);

    bytes public constant CREATION_CODE = type(SpritzReceiver).creationCode;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DEPLOYER_ROLE, msg.sender);
    }

    /**
     * @dev Generate a unique salt value from controller, spritzPay, and accountReference.
     * @param controller The address for the controller.
     * @param spritzPay The address for SpritzPay.
     * @param accountReference The reference for the target account
     * @return The unique salt for the CREATE2 operation.
     */
    function getSalt(address controller, address spritzPay, bytes32 accountReference) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(controller, spritzPay, accountReference));
    }

    /**
     * @dev Deploy a new contract instance using CREATE2.
     * @param controller The address for the controller.
     * @param spritzPay The address for SpritzPay.
     * @param accountReference The reference for the target account
     * @return The address of the deployed contract.
     */
    function deploy(address controller, address spritzPay, bytes32 accountReference) external onlyRole(DEPLOYER_ROLE) returns (address) {
        bytes32 salt = getSalt(controller, spritzPay, accountReference);
        address deployedAddress = Create2.deploy(0, salt, CREATION_CODE);

        emit ReceiverDeployed(deployedAddress);
        return deployedAddress;
    }


    /**
    * @dev Compute the address of a contract that would be deployed using specific parameters.
     * @param controller The address for the controller.
     * @param spritzPay The address for SpritzPay.
     * @param accountReference The reference for the target account
     * @return The computed address of the contract.
     */
    function computeAddress(address controller, address spritzPay, bytes32 accountReference) external view returns (address) {
        bytes32 salt = getSalt(controller, spritzPay, accountReference);
        return Create2.computeAddress(salt, keccak256(CREATION_CODE));
    }
}
