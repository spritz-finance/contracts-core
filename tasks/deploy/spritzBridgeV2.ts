/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { getBridgeQuote } from "../../test/bridge/jumper";

const TREASURY_WALLET = "0xC812d763b1b17F7ceF189F50A0a8C2d9419852E3";
const BRIDGE_BOT = "0x79f02cB9C54c3C07D4f6510910a9849Fa8DdA0c1";
const JUMPER_BRIDGE_ADDRESS = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

task("deploy:SpritzBridgeV2").setAction(async function (_taskArguments: TaskArguments, hre) {
  const bridgeFactory = await hre.ethers.getContractFactory("SpritzBridgeV2");
  console.log("Deploying");
  const args: [string, string, string] = [TREASURY_WALLET, BRIDGE_BOT, JUMPER_BRIDGE_ADDRESS];
  const bridge = await bridgeFactory.deploy(...args);
  await bridge.deployTransaction.wait(6);
  console.log(`Deployed to ${bridge.address} with tx: ${bridge.deployTransaction.hash}`);
  await hre.run(`verify:verify`, {
    address: bridge.address,
    contract: "contracts/utility/SpritzBridgeV2.sol:SpritzBridgeV2",
    constructorArguments: args,
  });
});

const SPRITZ_BRIDGE_ADDRESS = "0x9463Ca3392c7c4db7bB0dc22a03210Fe308A789f";
const USDC_BSC_ADDRESS = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
const USDC_POLYGON_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CIRCLE_RECEIVING_ADDRESS = "0x4b7d6c3cea01f4d54a9cad6587da106ea39da1e6";

task("run:SpritzBridgeV2").setAction(async function (_taskArguments: TaskArguments, hre) {
  const bridgeFactory = await hre.ethers.getContractFactory("SpritzBridgeV2");

  const bridge = bridgeFactory.attach(SPRITZ_BRIDGE_ADDRESS);

  const erc20Factory = await hre.ethers.getContractFactory("ERC20");
  const usdc = erc20Factory.attach(USDC_BSC_ADDRESS);

  const balance = await usdc.balanceOf(bridge.address);

  console.log("balance to bridge: " + ethers.utils.formatUnits(balance, await usdc.decimals()));

  const params = await getBridgeQuote({
    fromChain: hre.network.config.chainId?.toString() ?? "1",
    toChain: "137",
    fromAddress: bridge.address,
    fromToken: USDC_BSC_ADDRESS,
    toAddress: CIRCLE_RECEIVING_ADDRESS,
    toToken: USDC_POLYGON_ADDRESS,
    fromAmount: balance.toString(),
  });

  console.log("got params", params);

  const bridgeResult = await bridge.bridgeToken(USDC_BSC_ADDRESS, balance, params.data, {
    value: params.value,
    gasPrice: params.gasPrice,
    gasLimit: params.gasLimit,
  });

  console.log("result", bridgeResult);
});
