/* eslint-disable @typescript-eslint/no-explicit-any */
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyContract, verifyContractUsingDefender, verifyProxyContract } from "../utils/verify";
import { getContractConfig } from "./config";

task("upgrade:spritz-pay-v3")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("spritzPay", _taskArguments, hre);

    const { args } = config;
    console.log(`Upgrading Spritz ${_taskArguments.env} contract on ${hre.network.name}`);

    const spritzPayFactory = await hre.ethers.getContractFactory("SpritzPayV3");

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

task("verify:spritz-pay-v3").setAction(async function (_taskArguments: TaskArguments, hre) {
  const implementationAddress = "0x6bF2BC4F96B374c0ae92a07fC8B93B2172837202";
  console.log("Implementation contract address", implementationAddress);

  await verifyContract(implementationAddress, hre, [], {
    contract: "contracts/SpritzPayV3.sol:SpritzPayV3",
  });
});

task("deploy:spritz-pay-v3")
  .addOptionalParam("env", "Production or Staging", "production", types.string)
  .setAction(async function (_taskArguments: TaskArguments, hre) {
    const config = getContractConfig("spritzPay", _taskArguments, hre);

    const { args } = config;

    console.log(`Deploying Spritz ${_taskArguments.env} contract to ${hre.network.name} with args`, { args });

    const spritzPayFactory = await hre.ethers.getContractFactory("SpritzPayV3");

    const proxy = await hre.upgrades.deployProxy(spritzPayFactory, args, {
      timeout: 0,
    });
    await proxy.deployed();

    console.log("Transferring proxyadmin ownership to ", args[0]);
    await hre.upgrades.admin.transferProxyAdminOwnership(args[0]);

    console.log("Proxy contract address: ", proxy.address);

    const implementationAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
    console.log("Implementation contract address", implementationAddress);

    const implementationContract = await hre.ethers.getContractAt("SpritzPayV3", implementationAddress);

    await verifyProxyContract(proxy, implementationContract, hre, [], {
      contract: "contracts/SpritzPayV3.sol:SpritzPayV3",
    });
  });
