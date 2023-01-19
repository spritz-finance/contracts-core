import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
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
    const [deployer, subscriber, paymentProcessor, bob] = await ethers.getSigners();

    const spritzPay = await waffle.deployMockContract(deployer, SpritzPay.abi);

    const PaymentTokenFactory = (await ethers.getContractFactory("MockToken")) as MockToken__factory;
    const paymentToken = (await PaymentTokenFactory.deploy()) as MockToken;

    const SmartPayFactory = (await ethers.getContractFactory("SpritzSmartPay")) as SpritzSmartPay__factory;
    const smartPay = (await SmartPayFactory.deploy(
      deployer.address,
      spritzPay.address,
      paymentProcessor.address,
    )) as SpritzSmartPay;
    await smartPay.deployed();

    await paymentToken.mint(subscriber.address, "10000000000000000000");

    return {
      paymentToken,
      spritzPay,
      smartPay,
      deployer,
      subscriber,
      bob,
      paymentProcessor,
    };
  };

  describe("Deployment and Setup", () => {
    it("deploys a contract", async () => {
      const { smartPay } = await loadFixture(setupFixture);
      expect(smartPay.address).to.be.properAddress;
    });

    it("flags floating promises", async () => {
      const { smartPay, paymentProcessor } = await loadFixture(setupFixture);
      const txReceiptUnresolved = await smartPay.revokePaymentProcessor(paymentProcessor.address);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(txReceiptUnresolved.wait()).to.be.reverted;
    });
  });

  describe("createSubscriptionBySignature", () => {
    it("allows creating a subscription from a signed typed data structure", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);
      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "10000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      const txReceipt = await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );

      const event = await getSubscriptionCreatedEventData(txReceipt);
      expect(event.subscriber).to.eq(subscriber.address);
    });

    it("emits all data required for off-chain storage", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "10000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      const txReceipt = await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );

      const event = await getSubscriptionCreatedEventData(txReceipt);

      expect(event.subscriber).to.eq(subscriber.address);
      expect(event.paymentToken).to.eq(paymentTokenContract.address);
      expect(event.paymentAmountMax).to.eq(paymentAmountMax);
      expect(event.startTime).to.eq(startTime);
      expect(event.paymentReference).to.eq(paymentReference);
      expect(event.totalPayments).to.eq(totalPayments);
      expect(event.cadence).to.eq(cadence);
      expect(event.subscriptionType).to.eq(subscriptionType);
    });

    it("prevents creating a subscription without a valid signed message", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract, bob } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: bob,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "10000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      await expect(
        smartPay.createSubscriptionBySignature(
          subscriber.address,
          paymentToken,
          paymentAmountMax,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          subscriptionType,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSignature");
    });

    it("prevents creating a subscription without a payment amount", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "0",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      await expect(
        smartPay.createSubscriptionBySignature(
          subscriber.address,
          paymentToken,
          paymentAmountMax,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          subscriptionType,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSubscription");
    });

    it("prevents creating a subscription without a start time", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "1000000",
        startTime: 0,
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      await expect(
        smartPay.createSubscriptionBySignature(
          subscriber.address,
          paymentToken,
          paymentAmountMax,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          subscriptionType,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSubscription");
    });

    it("prevents creating a subscription if any of the input parameters are changed", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const { paymentToken, startTime, paymentReference, totalPayments, cadence, subscriptionType, signature } =
        await getSignedSubscription({
          signer: subscriber,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmountMax: "1000000",
          startTime: Date.now(),
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
          subscriptionType: 0,
        });

      await expect(
        smartPay.createSubscriptionBySignature(
          subscriber.address,
          paymentToken,
          "2000000",
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          subscriptionType,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSignature");
    });

    it("prevents submitting a signature twice", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "1000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );

      await expect(
        smartPay.createSubscriptionBySignature(
          subscriber.address,
          paymentToken,
          paymentAmountMax,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
          subscriptionType,
          signature,
        ),
      ).to.be.revertedWithCustomError(smartPay, "SubscriptionAlreadyExists");
    });
  });

  describe("deleteSubscription", () => {
    it("allows an auhtorized account to delete their subscription", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "1000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      const txReceipt = await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );

      const event = await getSubscriptionCreatedEventData(txReceipt);

      let subscription = await smartPay.subscriptions(event.subscriptionId);
      expect(subscription.startTime).to.eq(startTime);

      await smartPay.connect(paymentProcessor).deleteSubscription(event.subscriptionId);

      subscription = await smartPay.subscriptions(event.subscriptionId);
      expect(subscription.startTime).to.eq(0);
    });

    it("prevents non-authorized accounts from deleting subscriptions", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "1000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      const txReceipt = await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );
      const event = await getSubscriptionCreatedEventData(txReceipt);

      await expect(smartPay.deleteSubscription(event.subscriptionId)).to.be.reverted;
    });

    it("reverts if the subscription does not exist", async () => {
      const { smartPay, paymentProcessor } = await loadFixture(setupFixture);

      await expect(smartPay.connect(paymentProcessor).deleteSubscription(reference)).to.be.revertedWithCustomError(
        smartPay,
        "SubscriptionNotFound",
      );
    });

    it('emits a "SubscriptionDeleted" event on successful deletion', async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const {
        paymentToken,
        paymentAmountMax,
        startTime,
        paymentReference,
        totalPayments,
        cadence,
        subscriptionType,
        signature,
      } = await getSignedSubscription({
        signer: subscriber,
        contract: smartPay,
        paymentToken: paymentTokenContract.address,
        paymentAmountMax: "1000000",
        startTime: Date.now(),
        totalPayments: 10,
        paymentReference: reference,
        cadence: 0,
        subscriptionType: 0,
      });

      const txReceipt = await smartPay.createSubscriptionBySignature(
        subscriber.address,
        paymentToken,
        paymentAmountMax,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        subscriptionType,
        signature,
      );

      const event = await getSubscriptionCreatedEventData(txReceipt);

      await expect(smartPay.connect(paymentProcessor).deleteSubscription(event.subscriptionId)).to.emit(
        smartPay,
        "SubscriptionDeleted",
      );
    });
  });

  describe.skip("processSubscription", () => {
    it("allows a valid payment to be charged", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);
      await spritzPay.mock.delegatedPayWithToken.returns();

      const timestamp = Math.ceil(Date.now() / 1000);

      await time.setNextBlockTimestamp(timestamp);

      await smartPay
        .connect(subscriber)
        .createSubscription(paymentTokenContract.address, "10000001", timestamp, 10, reference, 0, 0);

      await smartPay
        .connect(paymentProcessor)
        .processTokenPayment(
          subscriber.address,
          "10000000",
          paymentTokenContract.address,
          "10000001",
          timestamp,
          10,
          reference,
          0,
          0,
        );
    });

    it("allows a valid payment to be charged", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract, spritzPay } = await loadFixture(setupFixture);
      await spritzPay.mock.payWithTokenSubscription.returns();

      const timestamp = Math.ceil(Date.now() / 1000);
      const { paymentToken, paymentAmount, startTime, paymentReference, totalPayments, cadence, signature } =
        await getSignedSubscription({
          signer: subscriber,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmount: "10000000",
          startTime: timestamp,
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
        });

      await paymentTokenContract.connect(subscriber).increaseAllowance(smartPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      await smartPay.createSubscription(
        subscriber.address,
        paymentToken,
        paymentAmount,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        signature,
      );

      await smartPay.processPayment(
        subscriber.address,
        paymentToken,
        paymentAmount,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
      );
    });
    it("reverts if the call to the SpritzPay contract fails", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract, spritzPay } = await loadFixture(setupFixture);
      await spritzPay.mock.payWithTokenSubscription.reverts();

      const timestamp = Math.ceil(Date.now() / 1000);
      const { paymentToken, paymentAmount, startTime, paymentReference, totalPayments, cadence, signature } =
        await getSignedSubscription({
          signer: subscriber,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmount: "10000000",
          startTime: timestamp,
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
        });

      await paymentTokenContract.connect(subscriber).increaseAllowance(smartPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      await smartPay.createSubscription(
        subscriber.address,
        paymentToken,
        paymentAmount,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        signature,
      );

      await expect(
        smartPay.processPayment(
          subscriber.address,
          paymentToken,
          paymentAmount,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
        ),
      ).to.be.revertedWith("Mock revert");
    });

    it("reverts if the smart pay contract has not been given sufficient allowance", async () => {
      const { smartPay, subscriber, paymentToken: paymentTokenContract } = await loadFixture(setupFixture);

      const timestamp = Math.ceil(Date.now() / 1000);
      const { paymentToken, paymentAmount, startTime, paymentReference, totalPayments, cadence, signature } =
        await getSignedSubscription({
          signer: subscriber,
          contract: smartPay,
          paymentToken: paymentTokenContract.address,
          paymentAmount: "10000000",
          startTime: timestamp,
          totalPayments: 10,
          paymentReference: reference,
          cadence: 0,
        });

      await time.setNextBlockTimestamp(timestamp);

      await smartPay.createSubscription(
        subscriber.address,
        paymentToken,
        paymentAmount,
        startTime,
        totalPayments,
        paymentReference,
        cadence,
        signature,
      );

      await expect(
        smartPay.processPayment(
          subscriber.address,
          paymentToken,
          paymentAmount,
          startTime,
          totalPayments,
          paymentReference,
          cadence,
        ),
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });
  });
});
