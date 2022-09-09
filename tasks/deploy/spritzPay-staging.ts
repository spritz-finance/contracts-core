/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";
import {
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  TEAM_WALLET_BSC,
  TEAM_WALLET_OPTIMISM,
  TEAM_WALLET_POLYGON,
  TRADERJOE_ROUTER_AVALANCHE_ADDRESS,
  WAVAX_AVALANCHE_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": [TEAM_WALLET_POLYGON, QUICKSWAP_ROUTER_POLYGON_ADDRESS, WMATIC_POLYGON_ADDRESS],
  optimism: [TEAM_WALLET_OPTIMISM, QUICKSWAP_ROUTER_POLYGON_ADDRESS, WETH_OPTIMISM_ADDRESS],
  bsc: [TEAM_WALLET_BSC, PANCAKESWAP_ROUTER_BSC_ADDRESS, WBNB_BSC_ADDRESS],
  avalance: [TEAM_WALLET_POLYGON, TRADERJOE_ROUTER_AVALANCHE_ADDRESS, WAVAX_AVALANCHE_ADDRESS],
};

task("deploy-staging:SpritzPay").setAction(async function (_taskArguments: TaskArguments, hre) {
  const network = hre.hardhatArguments.network;

  const args = chainArgs[network as string];

  if (!args) {
    throw new Error(`Constructor arguments for network ${network} not found!`);
  }
  console.log("Deploying Spritz staging contract");

  const spritzPayStagingFactory: SpritzPayV1__factory = <SpritzPayV1__factory>(
    await hre.ethers.getContractFactory("SpritzPayV1")
  );

  const proxy = await hre.upgrades.deployProxy(spritzPayStagingFactory, args);
  await proxy.deployed();

  console.log("Spritz proxy contract address (staging): ", proxy.address);

  const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
  console.log("Spritz implementation contract address (staging): ", implementationAddress);

  const implementationContract = await hre.ethers.getContractAt("SpritzPayV1", implementationAddress);

  await verifyProxyContract(proxy, implementationContract, hre, [], {
    contract: "contracts/staging/SpritzPayV1_Staging.sol:SpritzPayV1",
  });
});
