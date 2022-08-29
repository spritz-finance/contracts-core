/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1_Staging__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";

const TEAM_WALLET_POLYGON = "0x71a1554E95E2b67696045e14f1dfD6BBD7fc876A";
const TEAM_WALLET_BSC = "0x71a1554E95E2b67696045e14f1dfD6BBD7fc876A";
const TEAM_WALLET_OPTIMISM = "0xDf6BcB7C51BBa1eA4B590D4b2F268AfAD5535d2C";
const WETH_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const WETH_OPTIMISM = "0x4200000000000000000000000000000000000006";
const WBNB_BSC = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": [TEAM_WALLET_POLYGON, WETH_POLYGON],
  optimism: [TEAM_WALLET_OPTIMISM, WETH_OPTIMISM],
  bsc: [TEAM_WALLET_BSC, WBNB_BSC],
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

  const implementationContract = await hre.ethers.getContractAt("SpritzPay_V1_Staging", implementationAddress);

  await verifyProxyContract(proxy, implementationContract, hre, [], {
    contract: "contracts/staging/SpritzPay_V1_Staging.sol:SpritzPay_V1_Staging",
  });
});
