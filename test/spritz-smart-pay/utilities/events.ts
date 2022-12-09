import { expect } from "chai";
import { ContractTransaction } from "ethers";

export const getSubscriptionCreatedEventData = async (txReceipt: ContractTransaction) => {
  const tx = await txReceipt.wait();
  const eventArgs = tx.events?.[0].args ?? null;
  expect(eventArgs).not.to.be.null;

  return {
    subscriber: eventArgs?.["subscriber"],
    subscriptionId: eventArgs?.["subscriptionId"],
    paymentToken: eventArgs?.["paymentToken"],
    paymentAmount: eventArgs?.["paymentAmount"],
    startTime: eventArgs?.["startTime"],
    totalPayments: eventArgs?.["totalPayments"],
    paymentReference: eventArgs?.["paymentReference"],
    cadence: eventArgs?.["cadence"],
  };
};
