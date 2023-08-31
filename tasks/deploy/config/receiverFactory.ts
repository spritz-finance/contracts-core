import { raise } from "../../utils/raise";
import {
  ADMIN_ARBITRUM,
  ADMIN_AVALANCHE,
  ADMIN_BSC,
  ADMIN_MAINNET,
  ADMIN_OPTIMISM,
  ADMIN_POLYGON,
  AUGUSTUS_REGISTRY_ARBITRUM,
  AUGUSTUS_REGISTRY_AVALANCHE,
  AUGUSTUS_REGISTRY_BSC,
  AUGUSTUS_REGISTRY_OPTIMISM,
  AUGUSTUS_REGISTRY_POLYGON,
  TEAM_WALLET_ARBITRUM,
  TEAM_WALLET_AVALANCHE,
  TEAM_WALLET_BSC,
  TEAM_WALLET_MAINNET,
  TEAM_WALLET_OPTIMISM,
  TEAM_WALLET_POLYGON,
  UNISWAP_V3_ROUTER_ADDRESS,
  WAVAX_AVALANCHE_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_ARBITRUM_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "../constants";
import { getSpritzPayContractConfig } from "./spritzPay";

const CONTROLLERS: Record<string, string> = {
  staging: "0xD6BE79a6A72A7d9cded331D91b479804AbA663dc",
  production: "0xaaaf0666a916bdf97710a8e44e42ba250490e5b8",
};

const DUMMY_SWAP_MODULE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const SWAP_MODULES: Record<string, string | null> = {
  "polygon-mainnet": "0x7e38fFBB0b11DF6f3afBCD010f43D073967abE19",
  bsc: null,
  mainnet: DUMMY_SWAP_MODULE,
  optimism: null,
  arbitrum: null,
  avalanche: null,
};

const ADMINS_FOR_ENV: Record<string, Record<string, string>> = {
  staging: {
    "polygon-mainnet": TEAM_WALLET_POLYGON,
    bsc: TEAM_WALLET_BSC,
    mainnet: TEAM_WALLET_MAINNET,
    optimism: TEAM_WALLET_OPTIMISM,
    arbitrum: TEAM_WALLET_ARBITRUM,
    avalanche: TEAM_WALLET_AVALANCHE,
  },
  production: {
    "polygon-mainnet": ADMIN_POLYGON,
    bsc: ADMIN_BSC,
    mainnet: ADMIN_MAINNET,
    optimism: ADMIN_OPTIMISM,
    arbitrum: ADMIN_ARBITRUM,
    avalanche: ADMIN_AVALANCHE,
  },
};

export const getReceiverFactoryContractConfig = (env: string, network: string) => {
  const spritzPayConfig = getSpritzPayContractConfig(env, network);
  return {
    args: [CONTROLLERS[env]],
    spritzPay: spritzPayConfig.proxy,
    swapModule: SWAP_MODULES[network] ?? raise(`No swap module for network: ${network}`),
    admin: ADMINS_FOR_ENV[env][network] ?? raise(`No admin for env: ${env}`),
  };
};

const swapModuleContractConfig: Record<string, [string, string]> = {
  "polygon-mainnet": [AUGUSTUS_REGISTRY_POLYGON, WMATIC_POLYGON_ADDRESS],
  bsc: [AUGUSTUS_REGISTRY_BSC, WBNB_BSC_ADDRESS],
  mainnet: [UNISWAP_V3_ROUTER_ADDRESS, WETH_MAINNET_ADDRESS],
  optimism: [AUGUSTUS_REGISTRY_OPTIMISM, WETH_OPTIMISM_ADDRESS],
  arbitrum: [AUGUSTUS_REGISTRY_ARBITRUM, WETH_ARBITRUM_ADDRESS],
  avalanche: [AUGUSTUS_REGISTRY_AVALANCHE, WAVAX_AVALANCHE_ADDRESS],
};

export const getReceiverSwapModuleConfig = (env: string, network: string) => {
  return {
    args: swapModuleContractConfig[network],
  };
};
