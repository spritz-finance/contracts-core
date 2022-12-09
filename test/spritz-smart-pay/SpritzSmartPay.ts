import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";

import { MockToken, SpritzSmartPay, SpritzSmartPay__factory } from "../../src/types";
import { MockToken__factory } from "../../src/types/factories/contracts/test/MockToken__factory";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SpritzPay = require("../../artifacts/contracts/SpritzPayV2.sol/SpritzPayV2.json");

describe.only("SpritzSmartPay", () => {
  const setupFixture = async () => {
    const [deployer, subscriber] = await ethers.getSigners();

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
    };
  };
  describe("Deployments", () => {
    it("Deploys a contract", async () => {
      const { smartPay } = await loadFixture(setupFixture);
      expect(smartPay.address).to.be.properAddress;
    });

    it("Flags floating promises", async () => {
      const { smartPay } = await loadFixture(setupFixture);
      const txReceiptUnresolved = await smartPay.pause();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(txReceiptUnresolved.wait()).to.be.reverted;
    });
  });
});
