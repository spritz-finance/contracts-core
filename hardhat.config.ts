import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-defender";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { config as dotenvConfig } from "dotenv";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
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
const alchemyPolygonMumbaiKey: string | undefined = process.env.ALCHEMY_POLYGON_MAINNET_KEY;
export const FORKING_URL = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyPolygonMainnetKey}`;

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  hardhat: 31337,
  mainnet: 1,
  ropsten: 3,
  optimism: 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  rinkeby: 4,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "bsc":
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
      break;
    case "polygon-mainnet":
      jsonRpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${alchemyPolygonMainnetKey}`;
      break;
    case "optimism":
      jsonRpcUrl = `https://opt-mainnet.g.alchemy.com/v2/${alchemyOptimismKey}`;
      break;
    case "rinkeby":
      jsonRpcUrl = "https://eth-rinkeby.alchemyapi.io/v2/";
      break;
    case "polygon-mumbai":
      jsonRpcUrl = `https://polygon-mumbai.g.alchemy.com/v2/${alchemyPolygonMumbaiKey}`;
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
    } as Record<string, string>,
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      forking: {
        url: FORKING_URL,
        // blockNumber: 30965500,
        blockNumber: 32802513,
      },
      accounts: {
        mnemonic,
      },
      // accounts: [{
      //   privateKey
      // }],
      // chainId: chainIds.hardhat,
      chainId: 137,
    },
    arbitrum: getChainConfig("arbitrum-mainnet"),
    avalanche: getChainConfig("avalanche"),
    bsc: getChainConfig("bsc"),
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism"),
    "polygon-mainnet": getChainConfig("polygon-mainnet"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
    rinkeby: getChainConfig("rinkeby"),
    ropsten: getChainConfig("ropsten"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.7",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
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
};

export default config;
