import {
  AUGUSTUS_REGISTRY_ARBITRUM,
  AUGUSTUS_REGISTRY_AVALANCHE,
  AUGUSTUS_REGISTRY_BSC,
  AUGUSTUS_REGISTRY_OPTIMISM,
  AUGUSTUS_REGISTRY_POLYGON,
  PANCAKESWAP_ROUTER_BSC_ADDRESS,
  UNISWAP_V3_ROUTER_ADDRESS,
  WAVAX_AVALANCHE_ADDRESS,
  WBNB_BSC_ADDRESS,
  WETH_ARBITRUM_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WETH_OPTIMISM_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "../constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swapModuleContractConfig: Record<string, [string, string]> = {
  "polygon-mainnet": [AUGUSTUS_REGISTRY_POLYGON, WMATIC_POLYGON_ADDRESS],
  bsc: [AUGUSTUS_REGISTRY_BSC, WBNB_BSC_ADDRESS],
  mainnet: [UNISWAP_V3_ROUTER_ADDRESS, WETH_MAINNET_ADDRESS],
  optimism: [AUGUSTUS_REGISTRY_OPTIMISM, WETH_OPTIMISM_ADDRESS],
  arbitrum: [AUGUSTUS_REGISTRY_ARBITRUM, WETH_ARBITRUM_ADDRESS],
  avalanche: [AUGUSTUS_REGISTRY_AVALANCHE, WAVAX_AVALANCHE_ADDRESS],
};

export const getSwapModuleContractConfig = (_env: string, network: string) =>
  swapModuleContractConfig[network as string];
