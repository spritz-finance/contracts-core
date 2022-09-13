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
const DUMP_ADDRESS = "0x1000000000000000000000000000000000000000";

describe("SpritzPay", function () {
  this.timeout(10000000);
  let usdcWhale: SignerWithAddress;
  let defiUser: SignerWithAddress;
  let admin: SignerWithAddress;
  let recipient: SignerWithAddress;
  let spritzPay: SpritzPayV1;
  let deadline = 0;

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  async function getDeadline() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp + 300;
  }

  async function clearBalance(token: string, holder: SignerWithAddress) {
    const [contract] = await getERC20Contracts([token]);
    const balance = await contract.balanceOf(holder.address);
    if (!balance.isZero()) {
      await contract.connect(holder).transfer(DUMP_ADDRESS, balance);
    }
  }

  this.beforeAll(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    recipient = signers[1];
    usdcWhale = await impersonateAccount(USDC_WHALE_ADDRESS);
    defiUser = await impersonateAccount(WBTC_HOLDER_ADDRESS);
  });

  this.beforeEach(async function () {
    const spritzPayFactory = await ethers.getContractFactory("SpritzPayV1");
    spritzPay = (await upgrades.deployProxy(spritzPayFactory, [
      recipient.address,
      QUICKSWAP_ROUTER_POLYGON_ADDRESS,
      WETH.address,
      admin.address,
    ])) as SpritzPayV1;
    await spritzPay.deployed();
    deadline = await getDeadline();
    await clearBalance(tokenAddress, recipient);
  });

  describe("payWithToken", () => {
    it("reverts if the user has not given the contract allowance", async () => {
      const paymentAmount = 100000;
      await expect(spritzPay.connect(usdcWhale).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        `FailedTokenTransfer("${tokenAddress}", "${recipient.address}", ${paymentAmount})`,
      );
    });

    it("transfers the payment amount to the recipient address", async () => {
      const [usdc] = await getERC20Contracts([tokenAddress]);
      const paymentAmount = 100000;
      await usdc.connect(usdcWhale).approve(spritzPay.address, paymentAmount);

      const balanceBefore = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceBefore = await usdc.balanceOf(recipient.address);

      await spritzPay.connect(usdcWhale).payWithToken(tokenAddress, paymentAmount, reference);

      const balanceAfter = await usdc.balanceOf(usdcWhale.address);
      const recipientBalanceAfter = await usdc.balanceOf(recipient.address);

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
          recipient.address,
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
      await spritzPay.connect(admin).pause();
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
          .payWithSwap(
            bestTrade.path[0],
            bestTrade.amountInMax,
            bestTrade.path[1],
            bestTrade.amountOut,
            reference,
            deadline,
          ),
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should swap token for token", async () => {
      const bestTrade = await getBestStablecoinTradeForToken(WBTC, 10);

      const [wbtcTokenContract, tokenBContract] = await getERC20Contracts([
        WBTC_POLYGON_ADDRESS,
        bestTrade.trade.route.path[1].address,
      ]);
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);

      await spritzPay
        .connect(defiUser)
        .payWithSwap(
          bestTrade.path[0],
          bestTrade.amountInMax,
          bestTrade.path[1],
          bestTrade.amountOut,
          reference,
          deadline,
        );

      const recipientBalanceAfter = await tokenBContract.balanceOf(recipient.address);
      expect(recipientBalanceAfter).to.eq(bestTrade.amountOut);
    });

    it("should swap native for token", async () => {
      const bestTrade = await getBestStablecoinTradeForToken(WETH, 5);

      await spritzPay
        .connect(defiUser)
        .payWithSwap(
          bestTrade.path[0],
          bestTrade.amountInMax,
          bestTrade.path[1],
          bestTrade.amountOut,
          reference,
          deadline,
          {
            value: bestTrade.amountInMax,
          },
        );
    });
  });

  describe("pausability", () => {
    it("only allows the owner to pause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).pause()).to.be.revertedWith("AccessControl");
    });

    it("only allows the owner to unpause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).unpause()).to.be.revertedWith("AccessControl");
    });
  });
});
