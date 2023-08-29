/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const BOT = "0x79f02cB9C54c3C07D4f6510910a9849Fa8DdA0c1";
const SPRITZ_PAY = "0xa40a3E8aeA2Fb9C38efE4d9F71F8d58175e0b6B3";
const REFERENCE = "0x0000000000000000000000000000000000000000646df671898bb61532452324";

task("deploy:SpritzReceiver").setAction(async function (_taskArguments: TaskArguments, hre) {
  const receiverFactory = await hre.ethers.getContractFactory("SpritzReceiver");
  console.log("Deploying");
  const args: [string, string, string] = [BOT, SPRITZ_PAY, REFERENCE];
  const receiverContract = await receiverFactory.deploy(...args);
  await receiverContract.deployTransaction.wait(6);
  console.log(`Deployed to ${receiverContract.address} with tx: ${receiverContract.deployTransaction.hash}`);
  await hre.run(`verify:verify`, {
    address: receiverContract.address,
    contract: "contracts/receiver/SpritzReceiver.sol:SpritzReceiver",
    constructorArguments: args,
  });
});
