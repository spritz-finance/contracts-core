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

    address public swapModule;

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
        bytes32 salt = getSalt(accountReference);

        address deployedAddress = Create2.deploy(0, salt, contractBytecode);

        emit ContractDeployed(deployedAddress);

        SpritzReceiver sr = SpritzReceiver(payable(deployedAddress));
        sr.setup(controller, spritzPay, address(this), accountReference);


        return deployedAddress;
    }

    /**
     * @dev Compute the address of a contract that would be deployed using a specific accountReference.
     * @param accountReference The reference for the account (usually bytes32).
     * @return The computed address of the contract.
     */
    function computeAddress(bytes32 accountReference) external view returns (address) {
        bytes32 salt = getSalt(accountReference);
        return Create2.computeAddress(salt, keccak256(contractBytecode));
    }

    /**
     * @dev Return the address of the swap module used for all receivers
     * @return The current swap module address
     */
    function getSwapModule() external view returns (address) {
        return swapModule;
    }

    /**
     * @dev Generate a unique salt value from accountReference.
     * @param _accountReference The reference for the account
     * @return The unique salt for the CREATE2 operation.
     */
    function getSalt(
        bytes32 _accountReference
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_accountReference));
    }
}
