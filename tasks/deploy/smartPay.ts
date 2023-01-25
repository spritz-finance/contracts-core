/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyProxyContract } from "../utils/verify";
import { getContractConfig } from "./config";

task("deploy:smart-pay")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("smartPay", _taskArguments, hre);

    const { args } = config;

    console.log(`Deploying SpritzSmartPay ${_taskArguments.env} contract to ${hre.network.name} with args`, { args });

    const smartPayFactory = await hre.ethers.getContractFactory("SpritzSmartPay");

    const proxy = await hre.upgrades.deployProxy(smartPayFactory, args);
    await proxy.deployed();

    console.log("Deployed contract to: ", proxy.address);

    console.log("Proxy contract address: ", proxy.address);

    const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
    console.log("Implementation contract address", implementationAddress);

    const implementationContract = await hre.ethers.getContractAt("SpritzSmartPay", implementationAddress);

    await verifyProxyContract(proxy, implementationContract, hre, [], {
      contract: "contracts/SpritzSmartPay.sol:SpritzSmartPay",
    });
  });
