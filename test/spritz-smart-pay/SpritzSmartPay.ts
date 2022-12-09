import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { formatPaymentReference } from "@spritz-finance/sdk/dist/utils/reference";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";

import { MockToken, SpritzSmartPay, SpritzSmartPay__factory } from "../../src/types";
import { MockToken__factory } from "../../src/types/factories/contracts/test/MockToken__factory";
import { getSubscriptionCreatedEventData } from "./utilities/events";
import { getSignedSubscription } from "./utilities/signedSubscription";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SpritzPay = require("../../artifacts/contracts/SpritzPayV2.sol/SpritzPayV2.json");

const reference = formatPaymentReference("6304ca0d2f5acf6d69b3c58e");

describe.only("SpritzSmartPay", () => {
  const setupFixture = async () => {
    const [deployer, subscriber, bob] = await ethers.getSigners();

    const spritzPay = await waffle.deployMockContract(deployer, SpritzPay.abi);

    const PaymentTokenFactory = (await ethers.getContractFactory("MockToken")) as MockToken__factory;
    const paymentToken = (await PaymentTokenFactory.deploy()) as MockToken;

    const SmartPayFactory = (await ethers.getContractFactory("SpritzSmartPay")) as SpritzSmartPay__factory;
    const smartPay = (await SmartPayFactory.deploy(spritzPay.address, paymentToken.address)) as SpritzSmartPay;
    await smartPay.deployed();

    return {
      paymentToken,
      spritzPay,
      smartPay,
      deployer,
      subscriber,
      bob,
    };
  };

  describe("Deployment and Setup", () => {
    it("deploys a contract", async () => {
      const { smartPay } = await loadFixture(setupFixture);
      expect(smartPay.address).to.be.properAddress;
    });

    it("flags floating promises", async () => {
      const { smartPay } = await loadFixture(setupFixture);
      const txReceiptUnresolved = await smartPay.pause();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(txReceiptUnresolved.wait()).to.be.reverted;
    });

    it("sets the payment token", async () => {
      const { smartPay, paymentToken } = await loadFixture(setupFixture);
      const tokenAddress = await smartPay.ACCEPTED_PAYMENT_TOKEN();
      expect(tokenAddress).to.eq(paymentToken.address);
    });
  });

  describe.only("createSubscription", () => {
    it("allows creating a subscription from a signed typed data structure", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);
      const { paymentToken, paymentAmount, startTime, paymentReference, totalPayments, cadence, signature } =
        await getSignedSubscription({
          signer: subscriber,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmount: "10000000",
          startTime: Date.now(),
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
        });

      const txReceipt = await smartPay.createSubscription(
        subscriber.address,
        paymentToken,
        paymentAmount,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        signature,
      );

      const event = await getSubscriptionCreatedEventData(txReceipt);
      expect(event.subscriber).to.eq(subscriber.address);
    });

    it("prevents creating a subscription without a valid signed message", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract, bob } = await loadFixture(setupFixture);

      const { paymentToken, paymentAmount, startTime, paymentReference, totalPayments, cadence, signature } =
        await getSignedSubscription({
          signer: bob,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmount: "10000000",
          startTime: Date.now(),
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
        });

      await expect(
        smartPay.createSubscription(
          subscriber.address,
          paymentToken,
          paymentAmount,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSignature");
    });
  });
});
