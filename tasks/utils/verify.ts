/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExtendedProposalResponse } from "@openzeppelin/hardhat-defender/dist/propose-upgrade";
import { ContractAddressOrInstance } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { BaseContract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function verifyProxyContract(
  proxy: BaseContract,
  implementation: BaseContract,
  hre: HardhatRuntimeEnvironment,
  args: any[] = [],
  taskArgs: Record<any, any> = {},
) {
  if (hre.network.name === "hardhat") {
    console.log("Skipping verification on local network");
    return;
  }

  await proxy.deployTransaction.wait(5);

  console.log("Deploy finished");

  await hre.run(`verify:verify`, {
    address: implementation.address,
    constructorArguments: args,
    ...taskArgs,
  });
}

export async function verifyContract(
  address: string,
  hre: HardhatRuntimeEnvironment,
  args: any[] = [],
  taskArgs: Record<any, any> = {},
) {
  if (hre.network.name === "hardhat") {
    console.log("Skipping verification on local network");
    return;
  }

  console.log("Deploy finished");

  await hre.run(`verify:verify`, {
    address,
    constructorArguments: args,
    ...taskArgs,
  });
}

export async function verifyContractUsingDefender(hre: HardhatRuntimeEnvironment, proposal: ExtendedProposalResponse) {
  console.log("Upgrade proposal created at:", proposal.url);
  const receipt = await proposal?.txResponse?.wait(5);
  console.log(`Contract address ${receipt?.contractAddress}`);

  await verifyContract(receipt!.contractAddress!, hre, [], {
    contract: "contracts/SpritzPayV3.sol:SpritzPayV3",
  });
}

export function getContractAddress(addressOrInstance: ContractAddressOrInstance): string {
  if (typeof addressOrInstance === "string") {
    return addressOrInstance;
  } else {
    return addressOrInstance.address;
  }
}
