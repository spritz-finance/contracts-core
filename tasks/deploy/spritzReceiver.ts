/* eslint-disable @typescript-eslint/no-explicit-any */
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { ParaswapExactInDelegateModule__factory, SpritzReceiverFactory__factory } from "../../src/types";
import { getContractConfig } from "./config";

task("deploy:SpritzReceiverFactory")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("receiverFactory", _taskArguments, hre);

    const receiverFactory = await hre.ethers.getContractFactory("SpritzReceiverFactory");
    console.log("Deploying with config", config);
    const receiverFactoryContract = await receiverFactory.deploy(
      ...(config.args as Parameters<SpritzReceiverFactory__factory["deploy"]>),
    );
    await receiverFactoryContract.deployTransaction.wait(6);
    console.log(
      `Deployed to ${receiverFactoryContract.address} with tx: ${receiverFactoryContract.deployTransaction.hash}`,
    );

    console.log("Setting spritzPay");
    await receiverFactoryContract.initialize(config.admin, config.spritzPay, config.swapModule);
    console.log("Done");

    await hre.run(`verify:verify`, {
      address: receiverFactoryContract.address,
      contract: "contracts/receiver/SpritzReceiverFactory.sol:SpritzReceiverFactory",
      constructorArguments: [...config.args],
    });
  });

task("deploy:verify-receiver")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("receiverFactory", _taskArguments, hre);
    await hre.run(`verify:verify`, {
      address: "0x5dF8c7C0725CDB6268F4503de880c38C45F69C61",
      contract: "contracts/receiver/SpritzReceiverFactory.sol:SpritzReceiverFactory",
      constructorArguments: [...config.args],
    });
  });

task("deploy:receiver-swap-module")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("receiverSwapModule", _taskArguments, hre);

    const receiverSwapModule = await hre.ethers.getContractFactory("ParaswapExactInDelegateModule");
    console.log("Deploying with config", config);
    const receiverSwapModuleContract = await receiverSwapModule.deploy(
      ...(config.args as Parameters<ParaswapExactInDelegateModule__factory["deploy"]>),
    );
    await receiverSwapModuleContract.deployTransaction.wait(6);
    console.log(
      `Deployed to ${receiverSwapModuleContract.address} with tx: ${receiverSwapModuleContract.deployTransaction.hash}`,
    );

    await hre.run(`verify:verify`, {
      address: receiverSwapModuleContract.address,
      contract: "contracts/swapModules/ParaswapExactInDelegateModule.sol:ParaswapExactInDelegateModule",
      constructorArguments: [...config.args],
    });
  });

task("deploy:verify-swap-module")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("receiverSwapModule", _taskArguments, hre);

    await hre.run(`verify:verify`, {
      address: "0x0fe08D911246566fdFD4afE0181a21ab810EE1C2",
      contract: "contracts/swapModules/ParaswapExactInDelegateModule.sol:ParaswapExactInDelegateModule",
      constructorArguments: [...config.args],
    });
  });
