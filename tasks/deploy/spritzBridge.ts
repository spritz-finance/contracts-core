/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("deploy:SpritzBridge").setAction(async function (_taskArguments: TaskArguments, hre) {
  // const x = await hre.ethers.getSigners();
  // console.log(x);

  // const bridgeFactory = await hre.ethers.getContractFactory("SpritzBridge");
  // const deployed = await bridgeFactory.deploy();
  await hre.run(`verify:verify`, {
    address: "0x6396dE2F7c219aDAC4D1cc5b925805231EE9a7C9",
    contract: "contracts/utility/SpritzBridge.sol:SpritzBridge",
    constructorArguments: [],
  });
});
