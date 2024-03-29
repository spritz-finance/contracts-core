/* eslint-disable @typescript-eslint/no-non-null-assertion */
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-defender";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { config as dotenvConfig } from "dotenv";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-spdx-license-identifier";
import "hardhat-storage-layout";
import "hardhat-tracer";
import { HardhatUserConfig } from "hardhat/config";
import { HttpNetworkConfig, NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/deploy";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined =
  process.env.MNEMONIC ?? "test test test test test test test test test test test junk";
const privateKey: string | undefined = process.env.DEPLOYMENT_PRIVATE_KEY;
const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
const alchemyPolygonMainnetKey: string | undefined = process.env.ALCHEMY_POLYGON_MAINNET_KEY;
const alchemyOptimismKey: string | undefined = process.env.ALCHEMY_OPTIMISM_KEY;
const alchemyArbitrumKey: string | undefined = process.env.ALCHEMY_ARBITRUM_KEY;
const alchemyMainnetKey: string | undefined = process.env.ALCHEMY_MAINNET_KEY;
const alchemyPolygonMumbaiKey: string | undefined = process.env.ALCHEMY_POLYGON_MAINNET_KEY;
const quicknodeBscKey: string | undefined = process.env.QUICKNODE_BSC_KEY;
const alchemyBaseKey: string | undefined = process.env.ALCHEMY_BASE_KEY;

export const FORKING_URL = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyPolygonMainnetKey}`;
// export const FORKING_URL = `https://alien-multi-field.bsc.quiknode.pro/${quicknodeBscKey}/`;
export const FORKING_CHAIN = "polygon";

const chainIds = {
  arbitrum: 42161,
  avalanche: 43114,
  bsc: 56,
  hardhat: 31337,
  mainnet: 1,
  ropsten: 3,
  optimism: 10,
  polygon: 137,
  "polygon-mumbai": 80001,
  rinkeby: 4,
  base: 8453,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;

  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "mainnet":
      jsonRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyMainnetKey}`;
      break;
    case "bsc":
      jsonRpcUrl = `https://alien-multi-field.bsc.quiknode.pro/${quicknodeBscKey}/`;
      break;
    case "polygon":
      jsonRpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyPolygonMainnetKey}`;
      break;
    case "optimism":
      jsonRpcUrl = `https://opt-mainnet.g.alchemy.com/v2/${alchemyOptimismKey}`;
      break;
    case "arbitrum":
      jsonRpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${alchemyArbitrumKey}`;
      break;
    case "rinkeby":
      jsonRpcUrl = "https://eth-rinkeby.alchemyapi.io/v2/";
      break;
    case "polygon-mumbai":
      jsonRpcUrl = `https://polygon-mumbai.g.alchemy.com/v2/${alchemyPolygonMumbaiKey}`;
      break;
    case "base":
      jsonRpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyBaseKey}`;
      break;
    case "ropsten":
      jsonRpcUrl = `https://ropsten.infura.io/v3/148c4ba669124e409d415eef42e2a750`;
      break;
    default:
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + infuraApiKey;
  }
  return {
    accounts: [privateKey!],
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
      ropsten: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
    } as Record<string, string>,
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      // forking: {
      //   url: (getChainConfig(FORKING_CHAIN) as HttpNetworkConfig).url,
      //   blockNumber: 48945029,
      // },
      accounts: {
        mnemonic,
      },
      // accounts: [{
      //   privateKey
      // }],
      // chainId: chainIds.hardhat,
      // chainId: 137,
      chainId: chainIds[FORKING_CHAIN],
      blockGasLimit: 150_000_000,
    },
    arbitrum: getChainConfig("arbitrum"),
    avalanche: getChainConfig("avalanche"),
    bsc: getChainConfig("bsc"),
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism"),
    polygon: getChainConfig("polygon"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
    rinkeby: getChainConfig("rinkeby"),
    ropsten: getChainConfig("ropsten"),
    base: getChainConfig("base"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.21",
    compilers: [
      {
        version: "0.8.7",
      },
      {
        version: "0.8.21",
      },
    ],
    overrides: {
      "contracts/receiver/SpritzReceiver.sol": {
        version: "0.8.21",
        settings: {},
      },
      "contracts/receiver/SpritzReceiverFactory.sol": {
        version: "0.8.21",
        settings: {},
      },
      "contracts/interfaces/ExactInputDelegateSwapModule.sol": {
        version: "0.8.21",
        settings: {},
      },
      "contracts/swapModules/ParaswapExactInDelegateModule.sol": {
        version: "0.8.21",
      },
      "contracts/protocol/factories/SpritzContractFactory.sol": {
        version: "0.8.21",
      },
    },
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 100000,
      },
      evmVersion: "paris",
    },
  },
  mocha: {
    timeout: 100000000,
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
  },
  defender: {
    apiKey: process.env.DEFENDER_TEAM_API_KEY!,
    apiSecret: process.env.DEFENDER_TEAM_API_SECRET_KEY!,
  },
  spdxLicenseIdentifier: {
    overwrite: true,
    runOnCompile: true,
  },
  abiExporter: {
    path: "./src/abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    only: ["Spritz.*"],
    spacing: 2,
    pretty: true,
    // format: "minimal",
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: ["Spritz.*"],
  },
};

export default config;
