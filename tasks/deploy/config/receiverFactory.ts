import { getSpritzPayContractConfig } from "./spritzPay";

const CONTROLLERS: Record<string, string> = {
  staging: "0xD6BE79a6A72A7d9cded331D91b479804AbA663dc",
  production: "0x79f02cB9C54c3C07D4f6510910a9849Fa8DdA0c1",
};

const DUMMY_SWAP_MODULE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const getReceiverFactoryContractConfig = (env: string, network: string) => {
  const spritzPayConfig = getSpritzPayContractConfig(env, network);
  return {
    args: [CONTROLLERS[env]],
    spritzPay: spritzPayConfig.proxy,
    swapModule: DUMMY_SWAP_MODULE,
  };
};
