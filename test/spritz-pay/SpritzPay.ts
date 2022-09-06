import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

import { SpritzPayV1 } from "../../src/types";
import { USDC_POLYGON_ADDRESS, USDC_WHALE_ADDRESS, WRAPPED_NATIVE_ADDRESS } from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";

const tokenAddress = USDC_POLYGON_ADDRESS;
const reference = "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e";
const PAYMENT_RECIPIENT = "0x1000000000000000000000000000000000000000";

describe("SpritzPay", function () {
  let usdcWhale: SignerWithAddress;
  let spritzPay: SpritzPayV1;

  this.beforeAll(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE_ADDRESS],
    });

    usdcWhale = await ethers.getSigner(USDC_WHALE_ADDRESS);
  });

  beforeEach(async function () {
    const spritzPayFactory = await ethers.getContractFactory("SpritzPayV1");
    spritzPay = (await upgrades.deployProxy(spritzPayFactory, [
      PAYMENT_RECIPIENT,
      WRAPPED_NATIVE_ADDRESS,
    ])) as SpritzPayV1;
    await spritzPay.deployed();
  });

  describe("payWithToken", () => {
    it("reverts if the user has not given the contract allowance", async () => {
      const paymentAmount = 100000;
      await expect(spritzPay.connect(usdcWhale).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        `FailedTokenTransfer("${tokenAddress}", "${PAYMENT_RECIPIENT}", ${paymentAmount})`,
      );
    });

    it("transfers the payment amount to the recipient address", async () => {
      const [usdc] = await getERC20Contracts([tokenAddress]);
      const paymentAmount = 100000;
      await usdc.connect(usdcWhale).approve(spritzPay.address, paymentAmount);

      const balanceBefore = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceBefore = await usdc.balanceOf(PAYMENT_RECIPIENT);

      await spritzPay.connect(usdcWhale).payWithToken(tokenAddress, paymentAmount, reference);

      const balanceAfter = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceAfter = await usdc.balanceOf(PAYMENT_RECIPIENT);

      expect(balanceBefore.sub(balanceAfter)).to.eq(paymentAmount);
      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.eq(paymentAmount);
    });

    it("emits a payment event", async () => {
      const [usdc] = await getERC20Contracts([tokenAddress]);
      const paymentAmount = 100000;
      await usdc.connect(usdcWhale).approve(spritzPay.address, paymentAmount);

      await expect(spritzPay.connect(usdcWhale).payWithToken(tokenAddress, paymentAmount, reference))
        .to.emit(spritzPay, "Payment")
        .withArgs(
          PAYMENT_RECIPIENT,
          usdcWhale.address,
          tokenAddress,
          paymentAmount,
          tokenAddress,
          paymentAmount,
          reference,
        );
    });

    it("reverts if the contract has been paused", async () => {
      const [usdc] = await getERC20Contracts([tokenAddress]);
      const paymentAmount = 100000;
      await usdc.connect(usdcWhale).approve(spritzPay.address, paymentAmount);
      await spritzPay.pause();

      await expect(spritzPay.connect(usdcWhale).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        "Pausable: paused",
      );
    });
  });

  describe("pausability", () => {
    it("only allows the owner to pause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).pause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("only allows the owner to unpause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
