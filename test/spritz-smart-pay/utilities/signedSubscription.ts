import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TypedDataDomain, TypedDataField } from "ethers";
import { network } from "hardhat";

import { SpritzSmartPay } from "../../../src/types";

const subscriptionMessageData = async (
  contract: SpritzSmartPay,
  paymentToken: string,
  paymentAmountMax: string,
  startTime: number,
  totalPayments: number,
  paymentReference: string,
  cadence: number,
  subscriptionType: number,
) => {
  //"Subscription(address paymentToken,uint256 paymentAmountMax,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,SubscriptionCadence cadence)"
  const subscription = [
    { name: "paymentToken", type: "address" },
    { name: "paymentAmountMax", type: "uint256" },
    { name: "startTime", type: "uint256" },
    { name: "totalPayments", type: "uint256" },
    { name: "paymentReference", type: "bytes32" },
    { name: "cadence", type: "uint8" },
    { name: "subscriptionType", type: "uint8" },
  ];
  const version = await contract.version();

  const domainData = {
    name: "SpritzSmartPay",
    version,
    chainId: network.config.chainId,
    verifyingContract: contract.address,
  };

  return [
    domainData,
    {
      Subscription: subscription,
    },
    {
      paymentToken,
      paymentAmountMax,
      startTime,
      totalPayments,
      paymentReference,
      cadence,
      subscriptionType,
    },
  ] as [TypedDataDomain, Record<string, TypedDataField[]>, Record<string, string | number>];
};

export const getSignedSubscription = async ({
  signer,
  contract,
  paymentToken,
  paymentAmountMax,
  startTime,
  totalPayments,
  paymentReference,
  cadence,
  subscriptionType,
}: {
  signer: SignerWithAddress;
  contract: SpritzSmartPay;
  paymentToken: string;
  paymentAmountMax: string;
  startTime: number;
  totalPayments: number;
  paymentReference: string;
  cadence: number;
  subscriptionType: number;
}) => {
  const data = await subscriptionMessageData(
    contract,
    paymentToken,
    paymentAmountMax,
    startTime,
    totalPayments,
    paymentReference,
    cadence,
    subscriptionType,
  );
  const signedMessage = await signer._signTypedData(...data);

  const signature = signedMessage.substring(2);
  const r = `0x${signature.substring(0, 64)}`;
  const s = `0x${signature.substring(64, 128)}`;
  const v = parseInt(signature.substring(128, 130), 16);

  return {
    paymentToken,
    paymentAmountMax,
    startTime,
    totalPayments,
    paymentReference,
    cadence,
    subscriptionType,
    signature: {
      v,
      r,
      s,
    },
  };
};
