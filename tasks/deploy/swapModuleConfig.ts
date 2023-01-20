import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

import {
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  UNISWAP_V3_ROUTER_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_ARBITRUM_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const contractConfig: Record<string, [string, string]> = {
  "polygon-mainnet": [QUICKSWAP_ROUTER_POLYGON_ADDRESS, WMATIC_POLYGON_ADDRESS],
  bsc: [PANCAKESWAP_ROUTER_BSC_ADDRESS, WBNB_BSC_ADDRESS],
  mainnet: [UNISWAP_V3_ROUTER_ADDRESS, WETH_MAINNET_ADDRESS],
  optimism: [UNISWAP_V3_ROUTER_ADDRESS, WETH_OPTIMISM_ADDRESS],
  arbitrum: [UNISWAP_V3_ROUTER_ADDRESS, WETH_ARBITRUM_ADDRESS],
};

export function getSwapModuleContractConfig(_taskArguments: TaskArguments, hre: HardhatRuntimeEnvironment) {
  const { env } = _taskArguments;
  const network = hre.hardhatArguments.network;
  const config = contractConfig?.[network as string];

  if (!config) {
    throw new Error(`Config not found! ${env} ${network}`);
  }

  return config;
}
