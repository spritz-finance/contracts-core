/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";
import {
  SPRITZ_TREASURY_WALLET,
  TEAM_WALLET_AVALANCHE,
  TEAM_WALLET_BSC,
  TEAM_WALLET_OPTIMISM,
  TEAM_WALLET_POLYGON,
  ZEROEX_ROUTER_AVALANCHE,
  ZEROEX_ROUTER_BSC,
  ZEROEX_ROUTER_OPTIMISM,
  ZEROEX_ROUTER_POLYGON,
} from "./constants";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": [SPRITZ_TREASURY_WALLET, ZEROEX_ROUTER_POLYGON],
  optimism: [SPRITZ_TREASURY_WALLET, ZEROEX_ROUTER_OPTIMISM],
  bsc: [SPRITZ_TREASURY_WALLET, ZEROEX_ROUTER_BSC],
  avalanche: [SPRITZ_TREASURY_WALLET, ZEROEX_ROUTER_AVALANCHE],
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
