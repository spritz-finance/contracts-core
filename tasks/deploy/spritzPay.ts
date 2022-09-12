/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzPayV1__factory } from "../../src/types";
import { verifyProxyContract } from "../utils/verify";
import {
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  SPRITZ_TREASURY_WALLET,
  TRADERJOE_ROUTER_AVALANCHE_ADDRESS,
  WAVAX_AVALANCHE_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

const chainArgs: Record<string, any> = {
  "polygon-mainnet": [SPRITZ_TREASURY_WALLET, QUICKSWAP_ROUTER_POLYGON_ADDRESS, WMATIC_POLYGON_ADDRESS],
  optimism: [SPRITZ_TREASURY_WALLET, QUICKSWAP_ROUTER_POLYGON_ADDRESS, WETH_OPTIMISM_ADDRESS], //TBD
  bsc: [SPRITZ_TREASURY_WALLET, PANCAKESWAP_ROUTER_BSC_ADDRESS, WBNB_BSC_ADDRESS],
  avalanche: [SPRITZ_TREASURY_WALLET, TRADERJOE_ROUTER_AVALANCHE_ADDRESS, WAVAX_AVALANCHE_ADDRESS],
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

  console.log("Deploying Spritz contract with args", { args });

  const proxy = await hre.upgrades.deployProxy(spritzPayFactory, args);
  await proxy.deployed();

  console.log("Spritz proxy contract address: ", proxy.address);

  const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
  console.log("Spritz implementation contract address: ", implementationAddress);

  const implementationContract = await hre.ethers.getContractAt("SpritzPayV1", implementationAddress);

  await verifyProxyContract(proxy, implementationContract, hre, []);
});
