/* eslint-disable @typescript-eslint/ban-ts-comment */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyContract } from "../utils/verify";
import { getContractConfig } from "./config";

task("deploy:swap-module-v2").setAction(async function (_taskArguments: TaskArguments, hre) {
  const config = getContractConfig("swapModule", _taskArguments, hre);

  const args = config;

  console.log(`Deploying SwapModule ${_taskArguments.env} contract to ${hre.network.name} with args`, { args });

  const SwapModuleFactory = await hre.ethers.getContractFactory("UniswapV2Module");

  // @ts-ignore
  const swapModule = await SwapModuleFactory.deploy(...args);
  await swapModule.deployed();

  console.log("Deployed SwapModule V2 to: ", swapModule.address);

  await swapModule.deployTransaction.wait(5);

  await verifyContract(swapModule.address, hre, args, {
    contract: "contracts/swapModules/UniswapV2Module.sol:UniswapV2Module",
  });
});

task("deploy:swap-module-v3").setAction(async function (_taskArguments: TaskArguments, hre) {
  const config = getContractConfig("swapModule", _taskArguments, hre);

  const args = config;

  console.log(`Deploying SwapModule contract to ${hre.network.name} with args`, { args });

  const SwapModuleFactory = await hre.ethers.getContractFactory("UniswapV3Module");

  // @ts-ignore
  const swapModule = await SwapModuleFactory.deploy(...args);
  await swapModule.deployed();

  console.log("Deployed SwapModule V3 to: ", swapModule.address);

  await swapModule.deployTransaction.wait(5);

  await verifyContract(swapModule.address, hre, args, {
    contract: "contracts/swapModules/UniswapV3Module.sol:UniswapV3Module",
  });
});
