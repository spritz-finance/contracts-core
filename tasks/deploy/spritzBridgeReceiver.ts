/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const BRIDGE_BOT = "0xAAAF0666A916bdf97710A8E44e42BA250490e5b8";

task("deploy:SpritzBridgeReceiver").setAction(async function (_taskArguments: TaskArguments, hre) {
  const bridgeFactory = await hre.ethers.getContractFactory("SpritzBridgeReceiver");
  console.log("Deploying");
  const args: [string] = [BRIDGE_BOT];
  const bridge = await bridgeFactory.deploy(...args);
  await bridge.deployTransaction.wait(10);
  console.log(`Deployed to ${bridge.address} with tx: ${bridge.deployTransaction.hash}`);
  await hre.run(`verify:verify`, {
    address: bridge.address,
    contract: "contracts/utility/SpritzBridgeReceiver.sol:SpritzBridgeReceiver",
    constructorArguments: args,
  });
});
