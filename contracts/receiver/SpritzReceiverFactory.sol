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

    using Create2 for bytes32;

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    // Bytecode for the contract to be deployed
    bytes public constant contractBytecode = type(SpritzReceiver).creationCode;

    // Immutable variables for controller and spritzPay
    address public immutable spritzPay;
    address public immutable controller;

    event ContractDeployed(address deployedAddress);

    constructor(address _controller, address _spritzPay) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DEPLOYER_ROLE, msg.sender);
        _setupRole(DEPLOYER_ROLE, _controller);
        controller = _controller;
        spritzPay = _spritzPay;
    }

    /**
     * @dev Deploy a new contract instance using CREATE2.
     * @param accountReference The reference for the account (usually bytes32).
     * @return The address of the deployed contract.
     */
    function deploy(bytes32 accountReference) public onlyRole(DEPLOYER_ROLE) returns (address) {
        bytes32 salt = getSalt(controller, spritzPay, accountReference);

        bytes memory bytecodeWithConstructorArgs = abi.encodePacked(
            contractBytecode,
            abi.encode(controller, spritzPay, accountReference)
        );

        address deployedAddress = Create2.deploy(0, salt, bytecodeWithConstructorArgs);
        emit ContractDeployed(deployedAddress);

        return deployedAddress;
    }

    /**
     * @dev Compute the address of a contract that would be deployed using a specific accountReference.
     * @param accountReference The reference for the account (usually bytes32).
     * @return The computed address of the contract.
     */
    function computeAddress(bytes32 accountReference) public view returns (address) {
        bytes32 salt = getSalt(controller, spritzPay, accountReference);

        bytes memory bytecodeWithConstructorArgs = abi.encodePacked(
            contractBytecode,
            abi.encode(controller, spritzPay, accountReference)
        );

        return Create2.computeAddress(salt, keccak256(bytecodeWithConstructorArgs));
    }

    /**
     * @dev Generate a unique salt value from controller, spritzPay, and accountReference.
     * @param _controller The address for the controller.
     * @param _spritzPay The address for SpritzPay.
     * @param _accountReference The reference for the account (usually bytes32).
     * @return The unique salt for the CREATE2 operation.
     */
    function getSalt(address _controller, address _spritzPay, bytes32 _accountReference) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_controller, _spritzPay, _accountReference));
    }
}
