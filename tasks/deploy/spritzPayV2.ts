/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyProxyContract } from "../utils/verify";
import { getContractConfig } from "./config";

task("deploy:SpritzPayV2")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig(_taskArguments, hre);

    const { args } = config;

    console.log(`Deploying Spritz ${_taskArguments.env} contract to ${hre.network.name} with args`, { args });

    const spritzPayStagingFactory = await hre.ethers.getContractFactory("SpritzPayV2");

    const proxy = await hre.upgrades.deployProxy(spritzPayStagingFactory, args);
    await proxy.deployed();

    console.log("Deployed contract to: ", proxy.address);

    console.log("Transferring proxyadmin ownership to ", args[0]);
    await hre.upgrades.admin.transferProxyAdminOwnership(args[0]);

    console.log("Proxy contract address: ", proxy.address);

    const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
    console.log("Implementation contract address", implementationAddress);

    const implementationContract = await hre.ethers.getContractAt("SpritzPayV2", implementationAddress);

    await verifyProxyContract(proxy, implementationContract, hre, [], {
      contract: "contracts/SpritzPayV2.sol:SpritzPayV2",
    });
  });

// task("verify:SpritzPayV2").setAction(async function (_taskArguments: TaskArguments, hre) {
//   const implementationAddress = "0x2F55CDae2D87285C07A870cdA780Bec7C241cA03";
//   console.log("Implementation contract address", implementationAddress);

//   await verifyContract(implementationAddress, hre, [], {
//     contract: "contracts/SpritzPayV2.sol:SpritzPayV2",
//   });
// });
