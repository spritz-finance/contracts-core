/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";

const ROUTER_ADDRESS = "0xe592427a0aece92de3edee1f18e0157c05861564";
const WRAPPED_NATIVE_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": ["0xe592427a0aece92de3edee1f18e0157c05861564", "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"],
  optimism: ["0xe592427a0aece92de3edee1f18e0157c05861564", "0x4200000000000000000000000000000000000006"],
};

task("deploy:SpritzPay").setAction(async function (_taskArguments: TaskArguments, hre) {
  const network = hre.hardhatArguments.network;

  const args = chainArgs[network!];

  if (!args) {
    throw new Error(`Constructor arguments for network ${network} not found!`);
  }

  const spritzPayFactory: SpritzPayV1__factory = <SpritzPayV1__factory>(
    await hre.ethers.getContractFactory("SpritzPayV1")
  );

  const proxy = await hre.upgrades.deployProxy(spritzPayFactory, args);
  await proxy.deployed();

  console.log("Spritz proxy contract address: ", proxy.address);

  const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
  console.log("Spritz implementation contract address: ", implementationAddress);

  const implementationContract = await hre.ethers.getContractAt("SpritzPay_V1", implementationAddress);

  await verifyProxyContract(proxy, implementationContract, hre, []);
});
