import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

import { SpritzPayV1 } from "../../src/types";
import {
  USDC_POLYGON_ADDRESS,
  USDC_WHALE_ADDRESS,
  WBTC_HOLDER_ADDRESS,
  WBTC_POLYGON_ADDRESS,
  WRAPPED_NATIVE_ADDRESS,
  ZEROEX_ROUTER_POLYGON,
  ZERO_ADDRESS,
} from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";
import { getPayWithSwapArgs } from "./helpers";

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
      ZEROEX_ROUTER_POLYGON,
    ])) as SpritzPayV1;
    await spritzPay.deployed();
  });

  describe.only("payWithSwap", () => {
    const sourceTokenAddress = WBTC_POLYGON_ADDRESS;
    const sourceTokenAddress2 = ZERO_ADDRESS;
    const paymentTokenAddress = USDC_POLYGON_ADDRESS;
    const paymentAmount = 1000000;
    const allowanceAmount = 1000000000000000;

    it("reverts if the contract has been paused", async () => {
      const [sourceToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);
      await sourceToken.connect(defiUser).approve(spritzPay.address, allowanceAmount);
      await spritzPay.pause();
      await expect(spritzPay.connect(defiUser).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        "Pausable: paused",
      );
    });

    describe("token for token", () => {
      it("swap directly with 0x should be valid", async () => {
        const quote = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress, reference);

        const [sourceToken, paymentToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);

        await sourceToken.connect(defiUser).approve(ZEROEX_ROUTER_POLYGON, allowanceAmount);
        const paymentTokenBalanceBefore = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalanceBefore = await sourceToken.balanceOf(defiUser.address);

        await defiUser.sendTransaction({
          to: ZEROEX_ROUTER_POLYGON,
          data: quote[4],
          value: quote[6].value,
          gasPrice: quote[6].gasPrice,
        });

        const paymentTokenBalance = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalance = await sourceToken.balanceOf(defiUser.address);

        console.log(`Source token difference: ${sourceTokenBalance.sub(sourceTokenBalanceBefore).toString()}`);
        console.log(`Payment token difference: ${paymentTokenBalance.sub(paymentTokenBalanceBefore).toString()}`);
      });

      it("should swap a token via the contract", async () => {
        const args = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress, reference);

        const [sourceToken, paymentToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);

        const paymentTokenBalanceBefore = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalanceBefore = await sourceToken.balanceOf(defiUser.address);

        await sourceToken.connect(defiUser).approve(spritzPay.address, args[1]);

        //@ts-ignore
        await spritzPay.connect(defiUser).payWithSwap(...args);

        const recipientBalanceAfter = await paymentToken.balanceOf(PAYMENT_RECIPIENT_ADDRESS);
        expect(recipientBalanceAfter).to.eq(paymentAmount);

        const contractSourceTokenBalanceAfter = await sourceToken.balanceOf(spritzPay.address);
        expect(contractSourceTokenBalanceAfter).to.eq(0);

        const contractPaymentTokenBalanceAfter = await paymentToken.balanceOf(spritzPay.address);
        expect(contractPaymentTokenBalanceAfter).to.eq(0);

        const paymentTokenBalance = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalance = await sourceToken.balanceOf(defiUser.address);

        console.log(`Source token difference: ${sourceTokenBalance.sub(sourceTokenBalanceBefore).toString()}`);
        console.log(`Payment token difference: ${paymentTokenBalance.sub(paymentTokenBalanceBefore).toString()}`);
      });
    });

    describe("native for token", () => {
      it("swap directly with 0x should be valid", async () => {
        const quote = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress2, reference);

        const [paymentToken] = await getERC20Contracts([paymentTokenAddress]);

        const paymentTokenBalanceBefore = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalanceBefore = await defiUser.getBalance();

        await defiUser.sendTransaction({
          to: ZEROEX_ROUTER_POLYGON,
          data: quote[4],
          value: quote[6].value,
          gasPrice: quote[6].gasPrice,
        });

        const paymentTokenBalance = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalance = await defiUser.getBalance();

        console.log(`Source token difference: ${sourceTokenBalance.sub(sourceTokenBalanceBefore).toString()}`);
        console.log(`Payment token difference: ${paymentTokenBalance.sub(paymentTokenBalanceBefore).toString()}`);
      });

      it("should swap native via the contract", async () => {
        const args = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress2, reference);

        const [paymentToken] = await getERC20Contracts([paymentTokenAddress]);

        const paymentTokenBalanceBefore = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalanceBefore = await defiUser.getBalance();

        //@ts-ignore
        await spritzPay.connect(defiUser).payWithSwap(...args);

        // const recipientBalanceAfter = await paymentToken.balanceOf(PAYMENT_RECIPIENT_ADDRESS);
        // expect(recipientBalanceAfter).to.eq(paymentAmount);

        const contractBalanceAfter = await spritzPay.provider.getBalance(spritzPay.address);
        expect(contractBalanceAfter).to.eq(0);

        const contractPaymentTokenBalanceAfter = await paymentToken.balanceOf(spritzPay.address);
        expect(contractPaymentTokenBalanceAfter).to.eq(0);

        const paymentTokenBalance = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalance = await defiUser.getBalance();

        console.log(`Source token difference: ${sourceTokenBalance.sub(sourceTokenBalanceBefore).toString()}`);
        console.log(`Payment token difference: ${paymentTokenBalance.sub(paymentTokenBalanceBefore).toString()}`);
      });
    });
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

  describe("pausability", () => {
    it("only allows the owner to pause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).pause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("only allows the owner to unpause the contract", async () => {
      await expect(spritzPay.connect(usdcWhale).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
