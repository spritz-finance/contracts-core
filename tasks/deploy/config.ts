import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

import {
  ADMIN_STAGING_POLYGON,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  SPRITZ_TREASURY_WALLET,
  TEAM_WALLET_POLYGON,
  WMATIC_POLYGON_ADDRESS,
} from "./constants";

export const contractConfig: Record<string, Record<string, { proxy: string; args: any[] }>> = {
  staging: {
    "polygon-mainnet": {
      proxy: "0x6920328902dA977aE96424fE911dA23c7E28DBEe",
      args: [ADMIN_STAGING_POLYGON, TEAM_WALLET_POLYGON, QUICKSWAP_ROUTER_POLYGON_ADDRESS, WMATIC_POLYGON_ADDRESS],
    },
  },
  production: {
    "polygon-mainnet": {
      proxy: "",
      args: [
        ADMIN_STAGING_POLYGON, //TODO: change to admin multisig
        SPRITZ_TREASURY_WALLET,
        QUICKSWAP_ROUTER_POLYGON_ADDRESS,
        WMATIC_POLYGON_ADDRESS,
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
