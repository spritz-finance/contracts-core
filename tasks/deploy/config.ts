import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

import {
  ACCEPTED_STABLECOINS_POLYGON,
  ADMIN_STAGING_POLYGON,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  SPRITZPAY_STAGING_POLYGON_ADDRESS,
  SPRITZ_TREASURY_WALLET,
  TEAM_WALLET_POLYGON,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

export const contractConfig: Record<string, Record<string, { proxy: string; args: any[] }>> = {
  staging: {
    "polygon-mainnet": {
      proxy: SPRITZPAY_STAGING_POLYGON_ADDRESS,
      args: [
        ADMIN_STAGING_POLYGON,
        TEAM_WALLET_POLYGON,
        QUICKSWAP_ROUTER_POLYGON_ADDRESS,
        WMATIC_POLYGON_ADDRESS,
        ACCEPTED_STABLECOINS_POLYGON,
      ],
    },
  },
  production: {
    "polygon-mainnet": {
      proxy: "", //TODO:
      args: [
        ADMIN_STAGING_POLYGON, //TODO: change to admin multisig
        SPRITZ_TREASURY_WALLET,
        QUICKSWAP_ROUTER_POLYGON_ADDRESS,
        WMATIC_POLYGON_ADDRESS,
        ACCEPTED_STABLECOINS_POLYGON,
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
