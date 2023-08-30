/* eslint-disable @typescript-eslint/no-explicit-any */
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyContract, verifyContractUsingDefender } from "../utils/verify";
import { getContractConfig } from "./config";
import { SPRITZPAY_AVALANCHE_ADDRESS, SPRITZPAY_STAGING_AVALANCHE_ADDRESS } from "./constants";

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
