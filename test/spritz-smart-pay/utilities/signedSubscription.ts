import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TypedDataDomain, TypedDataField } from "ethers";
import { network } from "hardhat";

import { SpritzSmartPay } from "../../../src/types";

const subscriptionMessageData = async (
  contract: SpritzSmartPay,
  paymentToken: string,
  paymentAmount: string,
  startTime: number,
  totalPayments: number,
  paymentReference: string,
  cadence: number,
) => {
  //"Subscription(address paymentToken,uint256 paymentAmount,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,SubscriptionCadence cadence)"
  const subscription = [
    { name: "paymentToken", type: "address" },
    { name: "paymentAmount", type: "uint256" },
    { name: "startTime", type: "uint256" },
    { name: "totalPayments", type: "uint256" },
    { name: "paymentReference", type: "bytes32" },
    { name: "cadence", type: "uint8" },
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
      paymentAmount,
      startTime,
      totalPayments,
      paymentReference,
      cadence,
    },
  ] as [TypedDataDomain, Record<string, TypedDataField[]>, Record<string, string | number>];
};

export const getSignedSubscription = async ({
  signer,
  contract,
  paymentToken,
  paymentAmount,
  startTime,
  totalPayments,
  paymentReference,
  cadence,
}: {
  signer: SignerWithAddress;
  contract: SpritzSmartPay;
  paymentToken: string;
  paymentAmount: string;
  startTime: number;
  totalPayments: number;
  paymentReference: string;
  cadence: number;
}) => {
  const data = await subscriptionMessageData(
    contract,
    paymentToken,
    paymentAmount,
    startTime,
    totalPayments,
    paymentReference,
    cadence,
  );
  const signedMessage = await signer._signTypedData(...data);

  const signature = signedMessage.substring(2);
  const r = `0x${signature.substring(0, 64)}`;
  const s = `0x${signature.substring(64, 128)}`;
  const v = parseInt(signature.substring(128, 130), 16);

  return {
    paymentToken,
    paymentAmount,
    startTime,
    totalPayments,
    paymentReference,
    cadence,
    signature: {
      v,
      r,
      s,
    },
  };
};
