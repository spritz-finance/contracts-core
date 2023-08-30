/* eslint-disable @typescript-eslint/no-explicit-any */
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { SpritzReceiverFactory__factory } from "../../src/types";
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
    await receiverFactoryContract.setSpritzPay(config.spritzPay);
    console.log("Done");

    console.log("Setting swapModule");
    await receiverFactoryContract.setSwapModule(config.swapModule);
    console.log("Done");

    await hre.run(`verify:verify`, {
      address: receiverFactoryContract.address,
      contract: "contracts/receiver/SpritzReceiverFactory.sol:SpritzReceiverFactory",
      constructorArguments: [...config.args],
    });
  });
