import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

import { SpritzPayV1 } from "../../src/types";
import { QUICKSWAP_ROUTER_POLYGON_ADDRESS } from "../../tasks/deploy/constants";
import {
  USDC_POLYGON_ADDRESS,
  USDC_WHALE_ADDRESS,
  WBTC_HOLDER_ADDRESS,
  WBTC_POLYGON_ADDRESS,
} from "../helpers/constants";
import { WBTC, WETH, getBestStablecoinTradeForToken, getERC20Contracts } from "../helpers/helpers";

const tokenAddress = USDC_POLYGON_ADDRESS;
const reference = "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e";
const PAYMENT_RECIPIENT_ADDRESS = "0x1000000000000000000000000000000000000000";

describe("SpritzPay", function () {
  this.timeout(10000000);
  let usdcWhale: SignerWithAddress;
  let defiUser: SignerWithAddress;
  let recipient: SignerWithAddress;
  let spritzPay: SpritzPayV1;

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  this.beforeAll(async () => {
    usdcWhale = await impersonateAccount(USDC_WHALE_ADDRESS);
    defiUser = await impersonateAccount(WBTC_HOLDER_ADDRESS);
    recipient = await impersonateAccount(PAYMENT_RECIPIENT_ADDRESS);
  });

  this.beforeEach(async function () {
    const spritzPayFactory = await ethers.getContractFactory("SpritzPayV1");
    spritzPay = (await upgrades.deployProxy(spritzPayFactory, [
      PAYMENT_RECIPIENT_ADDRESS,
      QUICKSWAP_ROUTER_POLYGON_ADDRESS,
      WETH.address,
    ])) as SpritzPayV1;
    await spritzPay.deployed();
  });

  describe("payWithToken", () => {
    it("reverts if the user has not given the contract allowance", async () => {
      const paymentAmount = 100000;
      await expect(spritzPay.connect(usdcWhale).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        `FailedTokenTransfer("${tokenAddress}", "${PAYMENT_RECIPIENT_ADDRESS}", ${paymentAmount})`,
      );
    });

    it("transfers the payment amount to the recipient address", async () => {
      const [usdc] = await getERC20Contracts([tokenAddress]);
      const paymentAmount = 100000;
      await usdc.connect(usdcWhale).approve(spritzPay.address, paymentAmount);

      const balanceBefore = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceBefore = await usdc.balanceOf(PAYMENT_RECIPIENT_ADDRESS);

      await spritzPay.connect(usdcWhale).payWithToken(tokenAddress, paymentAmount, reference);

      const balanceAfter = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceAfter = await usdc.balanceOf(PAYMENT_RECIPIENT_ADDRESS);

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
          PAYMENT_RECIPIENT_ADDRESS,
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

  describe("payWithSwap", () => {
    it("reverts if the contract has been paused", async () => {
      const [wbtcTokenContract] = await getERC20Contracts([WBTC_POLYGON_ADDRESS]);
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);
      await spritzPay.pause();

      const bestTrade = await getBestStablecoinTradeForToken(WBTC, 10);

      await expect(
        spritzPay
          .connect(defiUser)
          .payWithSwap(bestTrade.path[0], bestTrade.amountInMax, bestTrade.path[1], bestTrade.amountOut, reference),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should swap token for token", async () => {
      const bestTrade = await getBestStablecoinTradeForToken(WBTC, 10);

      const [wbtcTokenContract, tokenBContract] = await getERC20Contracts([
        WBTC_POLYGON_ADDRESS,
        bestTrade.trade.route.path[1].address,
      ]);
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);

      console.log(bestTrade);

      await spritzPay
        .connect(defiUser)
        .payWithSwap(bestTrade.path[0], bestTrade.amountInMax, bestTrade.path[1], bestTrade.amountOut, reference);

      const recipientBalanceAfter = await tokenBContract.balanceOf(PAYMENT_RECIPIENT_ADDRESS);

      expect(recipientBalanceAfter).to.eq(bestTrade.amountOut);
    });

    it("should swap native for token", async () => {
      const bestTrade = await getBestStablecoinTradeForToken(WETH, 5);

      await spritzPay
        .connect(defiUser)
        .payWithSwap(bestTrade.path[0], bestTrade.amountInMax, bestTrade.path[1], bestTrade.amountOut, reference, {
          value: bestTrade.amountInMax,
        });
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
