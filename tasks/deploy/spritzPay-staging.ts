/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1_Staging__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";
import {
  TEAM_WALLET_BSC,
  TEAM_WALLET_OPTIMISM,
  TEAM_WALLET_POLYGON,
  ZEROEX_ROUTER_AVALANCHE,
  ZEROEX_ROUTER_BSC,
  ZEROEX_ROUTER_OPTIMISM,
  ZEROEX_ROUTER_POLYGON,
} from "./constants";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": [TEAM_WALLET_POLYGON, ZEROEX_ROUTER_POLYGON],
  optimism: [TEAM_WALLET_OPTIMISM, ZEROEX_ROUTER_OPTIMISM],
  bsc: [TEAM_WALLET_BSC, ZEROEX_ROUTER_BSC],
  avalance: [TEAM_WALLET_POLYGON, ZEROEX_ROUTER_AVALANCHE],
};

task("deploy-staging:SpritzPay").setAction(async function (_taskArguments: TaskArguments, hre) {
  const network = hre.hardhatArguments.network;

  const args = chainArgs[network as string];

  if (!args) {
    throw new Error(`Constructor arguments for network ${network} not found!`);
  }
  console.log("Deploying Spritz staging contract");

  const spritzPayStagingFactory: SpritzPayV1_Staging__factory = <SpritzPayV1_Staging__factory>(
    await hre.ethers.getContractFactory("SpritzPayV1_Staging")
  );

  const proxy = await hre.upgrades.deployProxy(spritzPayStagingFactory, args);
  await proxy.deployed();

  console.log("Spritz proxy contract address (staging): ", proxy.address);

  const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
  console.log("Spritz implementation contract address (staging): ", implementationAddress);

  const implementationContract = await hre.ethers.getContractAt("SpritzPayV1_Staging", implementationAddress);

  await verifyProxyContract(proxy, implementationContract, hre, [], {
    contract: "contracts/staging/SpritzPayV1_Staging.sol:SpritzPayV1_Staging",
  });
});
