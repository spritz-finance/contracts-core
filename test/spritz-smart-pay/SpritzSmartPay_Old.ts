import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SpritzSmartPay } from "../../src/types";
import { LINK_POLYGON_ADDRESS } from "../helpers/constants";

const tokenAddress = LINK_POLYGON_ADDRESS;
const reference = "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e";

const getSubscriptionId = (address: string) => {
  return ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint128"], [address, 1]));
};

describe("SpritzSmartPay", function () {
  let smartPay: SpritzSmartPay;
  let deployer: SignerWithAddress;
  let sub: SignerWithAddress;

  beforeEach(async function () {
    [deployer, sub] = await ethers.getSigners();
    const SpritzSmartPayFactory = await ethers.getContractFactory("SpritzSmartPay");
    smartPay = (await SpritzSmartPayFactory.deploy(deployer.address, deployer.address)) as SpritzSmartPay;
    await smartPay.deployed();
  });

  describe("initial state", () => {
    it("has no active users initially", async () => {
      const activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).to.be.empty;
    });

    it("initially gives users a nonce of 0", async () => {
      const nonce = await smartPay.subscriptionNonce(sub.address);
      expect(nonce).to.eq(0);
    });
  });

  describe("subscription creation", () => {
    it("emits a subscription created event", async () => {
      await expect(smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0))
        .to.emit(smartPay, "SubscriptionCreated")
        .withArgs(sub.address, getSubscriptionId(sub.address));
    });

    it("increments user nonce on creation", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      let nonce = await smartPay.subscriptionNonce(sub.address);
      expect(nonce).to.eq(1);

      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      nonce = await smartPay.subscriptionNonce(sub.address);
      expect(nonce).to.eq(2);
    });

    it("adds the user to active users on creation", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      const activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).to.contain(sub.address);
    });

    it("emits a user activated event the first time", async () => {
      await expect(smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0))
        .to.emit(smartPay, "UserActivated")
        .withArgs(sub.address);

      await expect(smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0))
        .not.to.emit(smartPay, "UserActivated")
        .withArgs(sub.address);
    });

    it("keeps active user count the same on subsequent creation", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      let activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).to.have.length(1);

      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).to.have.length(1);
    });

    it("updates the user subscription count on creation", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      let activeSubscriptions = await smartPay.getUserSubscriptionCount(sub.address);
      expect(activeSubscriptions).to.eq(1);

      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      activeSubscriptions = await smartPay.getUserSubscriptionCount(sub.address);
      expect(activeSubscriptions).to.eq(2);
    });

    it("adds the subscription id to the user subscriptions on creation", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      let subscriptions = await smartPay.getUserSubscriptions(sub.address);
      expect(subscriptions).to.have.length(1);

      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      subscriptions = await smartPay.getUserSubscriptions(sub.address);
      expect(subscriptions).to.have.length(2);
    });
  });

  describe("deactivation", () => {
    it("emits a subscription deactivated event", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      const [subId] = await smartPay.getUserSubscriptions(sub.address);

      await expect(smartPay.connect(sub).deactivateSubscription(subId))
        .to.emit(smartPay, "SubscriptionDeactivated")
        .withArgs(sub.address, subId);
    });

    it("deletes the subscription", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      const [subId] = await smartPay.getUserSubscriptions(sub.address);

      await smartPay.connect(sub).deactivateSubscription(subId);

      const subscription = await smartPay.getSubscription(subId);
      expect(subscription.owner).to.eq("0x0000000000000000000000000000000000000000");
    });

    it("reduces the number of user subscriptions by 1", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);

      const countBefore = await smartPay.getUserSubscriptionCount(sub.address);

      const subscriptions = await smartPay.getUserSubscriptions(sub.address);
      const subId = subscriptions[0];

      await smartPay.connect(sub).deactivateSubscription(subId);

      const countAfter = await smartPay.getUserSubscriptionCount(sub.address);
      expect(countBefore.sub(countAfter)).to.eq(1);
    });

    it("removes the user from active users", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);

      const [subId1, subId2] = await smartPay.getUserSubscriptions(sub.address);

      await smartPay.connect(sub).deactivateSubscription(subId1);

      let activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).to.contain(sub.address);

      await smartPay.connect(sub).deactivateSubscription(subId2);

      activeUsers = await smartPay.getActiveUsers();
      expect(activeUsers).not.to.contain(sub.address);
    });

    it("throws if deactivator is not the owner", async () => {
      await smartPay.connect(sub).createSubscription(123456, 0, tokenAddress, 0, reference, 0);
      const [subId] = await smartPay.getUserSubscriptions(sub.address);

      await expect(smartPay.deactivateSubscription(subId)).to.be.revertedWith(
        `UnauthorizedExecutor("${deployer.address}")`,
      );
    });
  });
});
