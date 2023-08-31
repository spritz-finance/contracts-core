import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types/runtime";

import { getReceiverFactoryContractConfig, getReceiverSwapModuleConfig } from "./receiverFactory";
import { getSmartPayContractConfig } from "./smartPay";
import { getSpritzPayContractConfig } from "./spritzPay";
import { getSwapModuleContractConfig } from "./swapModule";

type ContractConfig = "spritzPay" | "smartPay" | "swapModule" | "receiverFactory" | "receiverSwapModule";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contractConfig: Record<ContractConfig, (env: string, network: string) => any> = {
  spritzPay: getSpritzPayContractConfig,
  smartPay: getSmartPayContractConfig,
  swapModule: getSwapModuleContractConfig,
  receiverFactory: getReceiverFactoryContractConfig,
  receiverSwapModule: getReceiverSwapModuleConfig,
};

export function getContractConfig(
  contract: ContractConfig,
  _taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { env } = _taskArguments;
  const network = hre.hardhatArguments.network;
  const config = contractConfig[contract]?.(env, network as string);

  if (!config) {
    throw new Error(`Config not found! ${env} ${network}`);
  }

  return config;
}
