import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

import {
  ACCEPTED_STABLECOINS_AVALANCHE,
  ACCEPTED_STABLECOINS_BSC,
  ACCEPTED_STABLECOINS_MAINNET,
  ACCEPTED_STABLECOINS_POLYGON,
  ADMIN_AVALANCHE,
  ADMIN_BSC,
  ADMIN_MAINNET,
  ADMIN_POLYGON,
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  SPRITZPAY_AVALANCHE_ADDRESS,
  SPRITZPAY_BSC_ADDRESS,
  SPRITZPAY_MAINNET_ADDRESS,
  SPRITZPAY_POLYGON_ADDRESS,
  SPRITZPAY_STAGING_AVALANCHE_ADDRESS,
  SPRITZPAY_STAGING_BSC_ADDRESS,
  SPRITZPAY_STAGING_MAINNET_ADDRESS,
  SPRITZPAY_STAGING_POLYGON_ADDRESS,
  SPRITZ_TREASURY_WALLET,
  TEAM_WALLET_AVALANCHE,
  TEAM_WALLET_BSC,
  TEAM_WALLET_MAINNET,
  TEAM_WALLET_POLYGON,
  TRADERJOUE_ROUTER_AVALANCHE_ADDRESS,
  UNISWAP_ROUTER_MAINNET_ADDRESS,
  WAVAX_AVALANCHE_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

export const contractConfig: Record<string, Record<string, { proxy: string; args: any[] }>> = {
  staging: {
    "polygon-mainnet": {
      proxy: SPRITZPAY_STAGING_POLYGON_ADDRESS,
      args: [
        ADMIN_POLYGON,
        TEAM_WALLET_POLYGON,
        QUICKSWAP_ROUTER_POLYGON_ADDRESS,
        WMATIC_POLYGON_ADDRESS,
        ACCEPTED_STABLECOINS_POLYGON,
      ],
    },
    bsc: {
      proxy: SPRITZPAY_STAGING_BSC_ADDRESS,
      args: [ADMIN_BSC, TEAM_WALLET_BSC, PANCAKESWAP_ROUTER_BSC_ADDRESS, WBNB_BSC_ADDRESS, ACCEPTED_STABLECOINS_BSC],
    },
    avalanche: {
      proxy: SPRITZPAY_STAGING_AVALANCHE_ADDRESS,
      args: [
        ADMIN_AVALANCHE,
        TEAM_WALLET_AVALANCHE,
        TRADERJOUE_ROUTER_AVALANCHE_ADDRESS,
        WAVAX_AVALANCHE_ADDRESS,
        ACCEPTED_STABLECOINS_AVALANCHE,
      ],
    },
    mainnet: {
      proxy: SPRITZPAY_STAGING_MAINNET_ADDRESS,
      args: [
        ADMIN_MAINNET,
        TEAM_WALLET_MAINNET,
        UNISWAP_ROUTER_MAINNET_ADDRESS,
        WETH_MAINNET_ADDRESS,
        ACCEPTED_STABLECOINS_MAINNET,
      ],
    },
  },
  production: {
    "polygon-mainnet": {
      proxy: SPRITZPAY_POLYGON_ADDRESS,
      args: [
        ADMIN_POLYGON,
        SPRITZ_TREASURY_WALLET,
        QUICKSWAP_ROUTER_POLYGON_ADDRESS,
        WMATIC_POLYGON_ADDRESS,
        ACCEPTED_STABLECOINS_POLYGON,
      ],
    },
    bsc: {
      proxy: SPRITZPAY_BSC_ADDRESS,
      args: [
        ADMIN_BSC,
        SPRITZ_TREASURY_WALLET,
        PANCAKESWAP_ROUTER_BSC_ADDRESS,
        WBNB_BSC_ADDRESS,
        ACCEPTED_STABLECOINS_BSC,
      ],
    },
    avalanche: {
      proxy: SPRITZPAY_AVALANCHE_ADDRESS,
      args: [
        ADMIN_AVALANCHE,
        SPRITZ_TREASURY_WALLET,
        TRADERJOUE_ROUTER_AVALANCHE_ADDRESS,
        WAVAX_AVALANCHE_ADDRESS,
        ACCEPTED_STABLECOINS_AVALANCHE,
      ],
    },
    mainnet: {
      proxy: SPRITZPAY_MAINNET_ADDRESS,
      args: [
        ADMIN_MAINNET,
        SPRITZ_TREASURY_WALLET,
        UNISWAP_ROUTER_MAINNET_ADDRESS,
        WETH_MAINNET_ADDRESS,
        ACCEPTED_STABLECOINS_MAINNET,
      ],
    },
  },
};

export function getContractConfig(_taskArguments: TaskArguments, hre: HardhatRuntimeEnvironment) {
  const { env } = _taskArguments;
  const network = hre.hardhatArguments.network;
  const config = contractConfig?.[env as string]?.[network as string];

  if (!config) {
    throw new Error(`Config not found! ${env} ${network}`);
  }

  return config;
}
