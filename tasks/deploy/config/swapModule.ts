import {
  AUGUSTUS_REGISTRY_POLYGON,
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  UNISWAP_V3_ROUTER_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_ARBITRUM_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "../constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swapModuleContractConfig: Record<string, [string, string]> = {
  "polygon-mainnet": [AUGUSTUS_REGISTRY_POLYGON, WMATIC_POLYGON_ADDRESS],
  bsc: [PANCAKESWAP_ROUTER_BSC_ADDRESS, WBNB_BSC_ADDRESS],
  mainnet: [UNISWAP_V3_ROUTER_ADDRESS, WETH_MAINNET_ADDRESS],
  optimism: [UNISWAP_V3_ROUTER_ADDRESS, WETH_OPTIMISM_ADDRESS],
  arbitrum: [UNISWAP_V3_ROUTER_ADDRESS, WETH_ARBITRUM_ADDRESS],
};

export const getSwapModuleContractConfig = (_env: string, network: string) =>
  swapModuleContractConfig[network as string];
