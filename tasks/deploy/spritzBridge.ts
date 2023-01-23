/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("deploy:SpritzBridge").setAction(async function (_taskArguments: TaskArguments, hre) {
  const bridgeFactory = await hre.ethers.getContractFactory("SpritzBridge");
  console.log("Deploying");
  const bridge = await bridgeFactory.deploy();
  await bridge.deployTransaction.wait(6);
  console.log(`Deployed to ${bridge.address} with tx: ${bridge.deployTransaction.hash}`);
  await hre.run(`verify:verify`, {
    address: bridge.address,
    contract: "contracts/utility/SpritzBridge.sol:SpritzBridge",
    constructorArguments: [],
  });
});
