// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

error WithdrawWETH();
error WithdrawETH();
error DepositETH();
error WrapETH();
error UnwrapETH();
error GetWETHAllowance();
error GetWETHBalance();

contract WETHUpgradeable is ContextUpgradeable {
    /**
     * @dev Emitted when the WETH address is updated.
     */
    event UpdateWETHAddress(address account);

    bytes4 private constant WITHDRAW_SELECTOR = bytes4(keccak256("withdraw(uint256)"));
    bytes4 private constant DEPOSIT_SELECTOR = bytes4(keccak256("deposit()"));
    bytes4 private constant ALLOWANCE_SELECTOR = bytes4(keccak256("allowance(address,address)"));
    bytes4 private constant BALANCE_OF_SELECTOR = bytes4(keccak256("balanceOf(address)"));

    address internal wethAddress;

    function __WETH_init(address _wethAddress) internal {
        wethAddress = _wethAddress;
    }

    /**
     * @notice Withdraw ether from wrapped native token contract
     * @param amount The amount of wrapped token to unwrap
     */
    function withdrawEther(uint256 amount) internal {
        uint256 etherBalanceBefore = address(this).balance;
        withdrawWETH(amount);
        if (address(this).balance - etherBalanceBefore != amount) {
            revert WithdrawETH();
        }
    }

    /**
     * @notice Wrap native token into erc20 token for swapping
     */
    function wrapEther() internal {
        depositEther();
        if (wethBalanceOf(address(this)) != msg.value) {
            revert WrapETH();
        }
    }

    function wethAllowance(address owner, address spender) internal view returns (uint256) {
        bytes memory allowanceData = abi.encodeWithSelector(ALLOWANCE_SELECTOR, owner, spender);
        (bool success, bytes memory returnData) = wethAddress.staticcall(allowanceData);
        if (!success) {
            revert GetWETHAllowance();
        }
        return abi.decode(returnData, (uint256));
    }

    function withdrawWETH(uint256 amount) private {
        bytes memory withdrawData = abi.encodeWithSelector(WITHDRAW_SELECTOR, amount);
        (bool success, ) = wethAddress.call(withdrawData);
        if (!success) {
            revert WithdrawWETH();
        }
    }

    function depositEther() private {
        bytes memory depositData = abi.encodeWithSelector(DEPOSIT_SELECTOR);
        (bool success, ) = wethAddress.call{ value: msg.value }(depositData);
        if (!success) {
            revert DepositETH();
        }
    }

    function wethBalanceOf(address account) private view returns (uint256) {
        bytes memory balanceOfData = abi.encodeWithSelector(BALANCE_OF_SELECTOR, account);
        (bool success, bytes memory returnData) = wethAddress.staticcall(balanceOfData);
        if (!success) {
            revert GetWETHBalance();
        }
        return abi.decode(returnData, (uint256));
    }

    /**
     * @dev Sets a new address for the WETH contract
     */
    function _setWETHAddress(address newWETHAddress) internal virtual {
        wethAddress = newWETHAddress;
        emit UpdateWETHAddress(_msgSender());
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}
