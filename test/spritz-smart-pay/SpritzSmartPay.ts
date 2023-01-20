import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { formatPaymentReference } from "@spritz-finance/sdk/dist/utils/reference";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";

import {
  MockToken,
  SpritzPayV2,
  SpritzPayV2__factory,
  SpritzSmartPay,
  SpritzSmartPay__factory,
  SpritzV3SwapModule,
  SpritzV3SwapModule__factory,
  WETH9,
  WETH9__factory,
} from "../../src/types";
import { MockToken__factory } from "../../src/types/factories/contracts/test/MockToken__factory";
import { getSubscriptionCreatedEventData } from "./utilities/events";
import { getSignedSubscription } from "./utilities/signedSubscription";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const V3RouterAbi = require("../../artifacts/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");

const reference = formatPaymentReference("6304ca0d2f5acf6d69b3c58e");
const PAYMENT_PROCESSOR_ROLE = "0xd7d8b7014b7ed36eb085c9e3e427b642d74cab75ecefda8a757042e63ec59919";

type SubscriptionParams = [string, string, number, number, string, number, number];

const now = () => Math.ceil(Date.now() / 1000);

enum Cadence {
  Monthly,
  Weekly,
  Daily,
}

enum SubscriptionType {
  DIRECT,
  SWAP,
}

describe.only("SpritzSmartPay", () => {
  const setupFixture = async () => {
    const [deployer, subscriber, paymentProcessor, paymentRecipient, bob] = await ethers.getSigners();

    const uniswapRouter = await waffle.deployMockContract(deployer, V3RouterAbi.abi);

    const WETHFactory = (await ethers.getContractFactory("WETH9")) as WETH9__factory;
    const weth9 = (await WETHFactory.deploy()) as WETH9;

    const PaymentTokenFactory = (await ethers.getContractFactory("MockToken")) as MockToken__factory;
    const paymentToken = (await PaymentTokenFactory.deploy()) as MockToken;

    const SwapModuleFactory = (await ethers.getContractFactory("SpritzV3SwapModule")) as SpritzV3SwapModule__factory;
    const swapModule = (await SwapModuleFactory.deploy(uniswapRouter.address, weth9.address)) as SpritzV3SwapModule;

    const SpritzPayFactory = (await ethers.getContractFactory("SpritzPayV2")) as SpritzPayV2__factory;
    const spritzPay = (await SpritzPayFactory.deploy()) as SpritzPayV2;

    await spritzPay.initialize(deployer.address, paymentRecipient.address, uniswapRouter.address, weth9.address, [
      paymentToken.address,
    ]);
    await spritzPay.setSwapModule(swapModule.address);

    const SmartPayFactory = (await ethers.getContractFactory("SpritzSmartPay")) as SpritzSmartPay__factory;
    const smartPay = (await SmartPayFactory.deploy(
      deployer.address,
      spritzPay.address,
      paymentProcessor.address,
    )) as SpritzSmartPay;
    await smartPay.deployed();

    await spritzPay.grantPaymentDelegate(smartPay.address);

    await paymentToken.mint(subscriber.address, "10000000000000000000");

    return {
      paymentToken,
      spritzPay,
      smartPay,
      uniswapRouter,
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

  describe("processTokenPayment", () => {
    it("prevents an unauthorized address from processing a payment", async () => {
      const {
        smartPay,
        subscriber,
        bob,
        paymentToken: paymentTokenContract,
        spritzPay,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(smartPay.connect(bob).processTokenPayment(subscriber.address, "10000000", ...subscriptionParams)).to
        .be.reverted;
    });

    it("allows a valid payment to be charged", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await smartPay
        .connect(paymentProcessor)
        .processTokenPayment(subscriber.address, "10000000", ...subscriptionParams);
    });

    it("prevents calling processTokenPayment on a swap subscription", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.SWAP,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay.connect(paymentProcessor).processTokenPayment(subscriber.address, "10000000", ...subscriptionParams),
      ).to.be.revertedWithCustomError(smartPay, "InvalidSubscriptionType");
    });

    it("prevents calling processTokenPayment with an amount greater than the max amount", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay.connect(paymentProcessor).processTokenPayment(subscriber.address, "10000001", ...subscriptionParams),
      ).to.be.revertedWithCustomError(smartPay, "InvalidPaymentValue");
    });

    it("prevents calling processTokenPayment on a subscription that does not exist", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay
          .connect(paymentProcessor)
          .processTokenPayment(paymentProcessor.address, "10000000", ...subscriptionParams),
      ).to.be.revertedWithCustomError(smartPay, "SubscriptionNotFound");
    });

    it("prevents calling processTokenPayment before the start time", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp - 100);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay.connect(paymentProcessor).processTokenPayment(subscriber.address, "10000000", ...subscriptionParams),
      ).to.be.revertedWithCustomError(smartPay, "InvalidPaymentCharge");
    });

    it("fails if SmartPay does not have delegate permissions on SpritzPay", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);
      await spritzPay.revokePaymentDelegate(smartPay.address);
      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay.connect(paymentProcessor).processTokenPayment(subscriber.address, "10000000", ...subscriptionParams),
      ).to.be.reverted;
    });

    it("allows a valid payment to be charged", async () => {
      const {
        smartPay,
        subscriber,
        paymentToken: paymentTokenContract,
        spritzPay,
        paymentProcessor,
      } = await loadFixture(setupFixture);

      const timestamp = now();

      await paymentTokenContract.connect(subscriber).increaseAllowance(spritzPay.address, "10000000");
      await time.setNextBlockTimestamp(timestamp);

      const subscriptionParams: SubscriptionParams = [
        paymentTokenContract.address,
        "10000000",
        timestamp,
        10,
        reference,
        Cadence.Monthly,
        SubscriptionType.DIRECT,
      ];

      await smartPay.connect(subscriber).createSubscription(...subscriptionParams);

      await expect(
        smartPay.connect(paymentProcessor).processTokenPayment(subscriber.address, "10000000", ...subscriptionParams),
      ).not.to.be.reverted;
    });
  });
});
