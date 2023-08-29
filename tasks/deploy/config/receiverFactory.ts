import { getSpritzPayContractConfig } from "./spritzPay";

const CONTROLLER_ADDRESS = "0x79f02cB9C54c3C07D4f6510910a9849Fa8DdA0c1";

export const getReceiverFactoryContractConfig = (env: string, network: string) => {
  const spritzPayConfig = getSpritzPayContractConfig(env, network);

  return {
    args: [CONTROLLER_ADDRESS, spritzPayConfig.proxy],
  };
};
