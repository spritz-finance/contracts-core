/* eslint-disable @typescript-eslint/no-explicit-any */
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

  await proxy.deployTransaction.wait(8);

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
