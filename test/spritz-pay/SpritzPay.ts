import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import axios from "axios";
import { expect } from "chai";
import { FixedNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";

import { SpritzPayV1 } from "../../src/types";
import {
  USDC_POLYGON_ADDRESS,
  USDC_WHALE_ADDRESS,
  WBTC_HOLDER_ADDRESS,
  WBTC_POLYGON_ADDRESS,
  WRAPPED_NATIVE_ADDRESS,
  ZEROEX_ROUTER_POLYGON,
} from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";

const zeroXResponse = require("./mocks/zeroxQuoteResponse1.json");

const tokenAddress = USDC_POLYGON_ADDRESS;
const reference = "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e";
const PAYMENT_RECIPIENT = "0x1000000000000000000000000000000000000000";

describe("SpritzPay", function () {
  this.timeout(10000000);
  let usdcWhale: SignerWithAddress;
  let defiUser: SignerWithAddress;
  let spritzPay: SpritzPayV1;

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  const getPayWithSwapArgs = async (buyToken: string, amount: number, sellToken: string) => {
    // const { data } = await axios.get(`https://polygon.api.0x.org/swap/v1/quote`, {
    //   params: {
    //     buyToken,
    //     buyAmount: amount,
    //     sellToken,
    //   },
    // });
    // console.log(JSON.stringify(data, undefined, 2));
    const quote = zeroXResponse;

    const { buyAmount, sellAmount, price, guaranteedPrice } = quote;

    const adjusted = FixedNumber.from(sellAmount)
      .mulUnsafe(FixedNumber.from(guaranteedPrice))
      .divUnsafe(FixedNumber.from(price))
      .round();
    // .mulUnsafe(FixedNumber.from("1.001"));
    // .ceiling();

    quote.adjustedSellAmount = adjusted.toString().split(".")[0];

    console.log({
      buyAmount,
      sellAmount,
      price,
      guaranteedPrice,
      adjusted,
      adjustedSellAmount: quote.adjustedSellAmount,
    });

    return [
      sellToken,
      quote.adjustedSellAmount,
      buyToken,
      quote.buyAmount,
      quote.data,
      reference,
      {
        value: quote.value,
        gasPrice: quote.gasPrice,
      },
    ];
  };

  this.beforeAll(async () => {
    usdcWhale = await impersonateAccount(USDC_WHALE_ADDRESS);
    defiUser = await impersonateAccount(WBTC_HOLDER_ADDRESS);
  });

  this.beforeEach(async function () {
    const spritzPayFactory = await ethers.getContractFactory("SpritzPayV1");
    spritzPay = (await upgrades.deployProxy(spritzPayFactory, [
      PAYMENT_RECIPIENT,
      ZEROEX_ROUTER_POLYGON,
    ])) as SpritzPayV1;
    await spritzPay.deployed();
  });

  describe.only("payWithSwap", () => {
    const sourceTokenAddress = WBTC_POLYGON_ADDRESS;
    const paymentTokenAddress = USDC_POLYGON_ADDRESS;
    const paymentAmount = 1000000000;

    it("reverts if the contract has been paused", async () => {
      const [sourceToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);
      await sourceToken.connect(defiUser).approve(spritzPay.address, 10000000);
      await spritzPay.pause();
      await expect(spritzPay.connect(defiUser).payWithToken(tokenAddress, 100000, reference)).to.be.revertedWith(
        "Pausable: paused",
      );
    });

    describe("token for token", () => {
      it("swap directly with 0x should be valid", async () => {
        const quote = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress);

        const [sourceToken, paymentToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);

        await sourceToken.connect(defiUser).approve(ZEROEX_ROUTER_POLYGON, 10000000);
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
        const args = await getPayWithSwapArgs(paymentTokenAddress, paymentAmount, sourceTokenAddress);

        const [sourceToken, paymentToken] = await getERC20Contracts([sourceTokenAddress, paymentTokenAddress]);

        const paymentTokenBalanceBefore = await paymentToken.balanceOf(defiUser.address);
        const sourceTokenBalanceBefore = await sourceToken.balanceOf(defiUser.address);

        await sourceToken.connect(defiUser).approve(spritzPay.address, 10000000);

        //@ts-ignore
        await spritzPay.connect(defiUser).payWithSwap(...args);

        const recipientBalanceAfter = await paymentToken.balanceOf(PAYMENT_RECIPIENT);
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
