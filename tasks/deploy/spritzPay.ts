/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyContractUsingDefender, verifyProxyContract } from "../utils/verify";
import { getContractConfig } from "./config";

task("deploy:SpritzPay")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig(_taskArguments, hre);

    const { args } = config;

    console.log(`Deploying Spritz ${_taskArguments.env} contract to ${hre.network.name} with args`, { args });

    const spritzPayStagingFactory = await hre.ethers.getContractFactory("SpritzPayV1");

    const proxy = await hre.upgrades.deployProxy(spritzPayStagingFactory, args);
    await proxy.deployed();

    console.log("Proxy contract address: ", proxy.address);

    const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
    console.log("Implementation contract address", implementationAddress);

    console.log("Transferring proxyadmin ownership to ", args[0]);
    await hre.upgrades.admin.transferProxyAdminOwnership(args[0]);

    const implementationContract = await hre.ethers.getContractAt("SpritzPayV1", implementationAddress);

    await verifyProxyContract(proxy, implementationContract, hre, [], {
      contract: "contracts/SpritzPayV1.sol:SpritzPayV1",
    });
  });

task("upgrade:SpritzPay")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig(_taskArguments, hre);

    const { args } = config;
    console.log(`Upgrading Spritz ${_taskArguments.env} contract on ${hre.network.name}`);

    const spritzPayFactory = await hre.ethers.getContractFactory("SpritzPayV1");

    //TODO: upload artifacts and verify
    //const artifact = hre.artifacts.readArtifactSync("contracts/SpritzPayV1.sol:SpritzPayV1")

    console.log("Preparing proposal...");
    const proposal = await hre.defender.proposeUpgrade(config.proxy, spritzPayFactory, {
      multisig: args[0],
      multisigType: "Gnosis Safe",
    });

    console.log("Upgrade proposal created at:", proposal.url);

    await verifyContractUsingDefender(hre, proposal);
  });
