import { ethers } from "hardhat";

export const getERC20Contracts = (tokenAddresses: string[]) => {
  return Promise.all(tokenAddresses.map(address => ethers.getContractAt("IERC20", address)));
};
