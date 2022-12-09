import { BaseProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { NATIVE_ZERO_ADDRESS } from "@spritz-finance/sdk";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";

import { Network, SpritzPaySDK } from "../../../sdk/dist/index.js";
import { FORKING_URL } from "../../hardhat.config";
import { IERC20Upgradeable, SpritzPayV2 } from "../../src/types";
import {
  ACCEPTED_STABLECOINS_POLYGON,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  UNISWAP_V3_ROUTER_ADDRESS,
} from "../../tasks/deploy/constants";
import { WBTC_HOLDER_ADDRESS, WBTC_POLYGON_ADDRESS, WMATIC_POLYGON_ADDRESS } from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";

type PaymentArgs = [string, string, string, string, string, string, number];

type EthPaymentArgs = [string, string, string, string, string, string, number, { value: string }];

const reference = "6304ca0d2f5acf6d69b3c58e";
// const formattedReference = formatPaymentReference(reference);
const DUMP_ADDRESS = "0x1000000000000000000000000000000000000000";

async function impersonateAccount(acctAddress: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  return await ethers.getSigner(acctAddress);
}

let paymentArgsCache: PaymentArgs | null = [
  "0x2791bca1f2de4661ed88a30c99a7a9449aa841740001f41bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  "53395",
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "10000000",
  "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e",
  1669212566,
];

let ethPaymentArgsCache: EthPaymentArgs | null = [
  "0x2791bca1f2de4661ed88a30c99a7a9449aa841740001f40d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  "12441641062185128577",
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "10000000",
  "0x00000000000000000000000000000000000000006304ca0d2f5acf6d69b3c58e",
  1669383980,
  { value: "12441641062185128577" },
];

const startBlock = 32802513;

describe("SpritzPayV2", function () {
  this.timeout(10000000);
  let admin: SignerWithAddress;
  let recipient: SignerWithAddress;
  let sdk: SpritzPaySDK;
  let spritzPay: SpritzPayV2;
  let wbtcTokenContract: IERC20Upgradeable;
  let paymentTokenContract: IERC20Upgradeable;
  let wbtcPaymentQuote: PaymentArgs;
  let ethPaymentQuote: EthPaymentArgs;
  let defiUser: SignerWithAddress;

  beforeEach(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: FORKING_URL,
            blockNumber: startBlock,
          },
        },
      ],
    });
    const signers = await ethers.getSigners();
    admin = signers[0];
    recipient = signers[1];

    sdk = new SpritzPaySDK({
      network: Network.Polygon,
      provider: admin.provider as BaseProvider,
      staging: true,
    });

    const SpritzPayFactory = await ethers.getContractFactory("SpritzPayV2");
    spritzPay = (await upgrades.deployProxy(SpritzPayFactory, [
      admin.address,
      recipient.address,
      QUICKSWAP_ROUTER_POLYGON_ADDRESS,
      WMATIC_POLYGON_ADDRESS,
      ACCEPTED_STABLECOINS_POLYGON,
    ])) as SpritzPayV2;

    await spritzPay.deployed();
    await spritzPay.setV3SwapTarget(UNISWAP_V3_ROUTER_ADDRESS);

    if (paymentArgsCache) {
      wbtcPaymentQuote = paymentArgsCache;
    } else {
      const { args } = await sdk.getV3SwapPaymentData(WBTC_POLYGON_ADDRESS, 10, reference);
      wbtcPaymentQuote = args as PaymentArgs;
      paymentArgsCache = wbtcPaymentQuote;
    }

    if (ethPaymentArgsCache) {
      ethPaymentQuote = ethPaymentArgsCache;
    } else {
      const { args } = await sdk.getV3SwapPaymentData(NATIVE_ZERO_ADDRESS, 10, reference);
      ethPaymentQuote = args as EthPaymentArgs;
      ethPaymentArgsCache = ethPaymentQuote;
    }

    wbtcTokenContract = (await getERC20Contracts([WBTC_POLYGON_ADDRESS]))[0];
    paymentTokenContract = (await getERC20Contracts([wbtcPaymentQuote[3]]))[0];
    defiUser = await impersonateAccount(WBTC_HOLDER_ADDRESS);
  });

  describe("payWithV3Swap: ERC-20", () => {
    it("prevents swapping if the contract has been paused", async () => {
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);
      await spritzPay.pause();

      await expect(spritzPay.connect(defiUser).payWithV3Swap(...wbtcPaymentQuote)).to.be.revertedWith(
        "Pausable: paused",
      );
    });

    it("prevents using a payment token that is not accepted", async () => {
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);

      const quoteCopy = [...wbtcPaymentQuote] as PaymentArgs;
      quoteCopy[3] = WBTC_POLYGON_ADDRESS;

      await expect(spritzPay.connect(defiUser).payWithV3Swap(...quoteCopy)).to.be.revertedWithCustomError(
        spritzPay,
        "NonAcceptedToken",
      );
    });

    it("prevents payment if the account has not given enough approval", async () => {
      await expect(spritzPay.connect(defiUser).payWithV3Swap(...wbtcPaymentQuote)).to.be.revertedWith(
        "ERC20: transfer amount exceeds allowance",
      );
    });

    it("prevents payment if the account does not have enough balance", async () => {
      await wbtcTokenContract.connect(admin).approve(spritzPay.address, 1000000000000000);
      await expect(spritzPay.connect(admin).payWithV3Swap(...wbtcPaymentQuote)).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance",
      );
    });

    it("increases the recipient ERC-20 balance by the amount payment amount", async () => {
      const paymentTokenBalanceBefore = await paymentTokenContract.balanceOf(recipient.address);

      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, wbtcPaymentQuote[2]);
      await spritzPay.connect(defiUser).payWithV3Swap(...wbtcPaymentQuote);

      const paymentTokenBalanceAfter = await paymentTokenContract.balanceOf(recipient.address);

      expect(paymentTokenBalanceAfter.sub(paymentTokenBalanceBefore)).to.eq(wbtcPaymentQuote[4]);
    });

    it('emits a "Payment" event on successful execution', async () => {
      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, wbtcPaymentQuote[2]);

      await expect(spritzPay.connect(defiUser).payWithV3Swap(...wbtcPaymentQuote)).to.emit(spritzPay, "Payment");
    });

    it("reduces the ERC-20 balance by the amount spent", async () => {
      const wbtcBalanceBefore = await wbtcTokenContract.balanceOf(defiUser.address);

      await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, wbtcPaymentQuote[2]);

      const txReceiptUnresolved = await spritzPay.connect(defiUser).payWithV3Swap(...wbtcPaymentQuote);
      const txReceipt = await txReceiptUnresolved.wait();
      const paymentEvent = txReceipt.events?.find(({ event }) => event === "Payment");
      const amountSpent = paymentEvent?.args?.sourceTokenAmount;

      const wbtcBalanceAfter = await wbtcTokenContract.balanceOf(defiUser.address);
      expect(wbtcBalanceBefore.sub(wbtcBalanceAfter)).to.be.lte(wbtcPaymentQuote[2]);
      expect(wbtcBalanceBefore.sub(wbtcBalanceAfter)).to.eq(amountSpent);
    });
  });

  describe("payWithV3Swap: Native", () => {
    it("prevents payment if the account does not send enough ETH", async () => {
      const quoteCopy = [...ethPaymentQuote];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      quoteCopy[quoteCopy.length - 1] = { value: "12441641062185128575" };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await expect(spritzPay.connect(admin).payWithV3Swap(...quoteCopy)).to.be.revertedWithCustomError(
        spritzPay,
        "InsufficientValue",
      );
    });

    it("increases the recipient ERC-20 balance by the amount payment amount", async () => {
      const paymentTokenBalanceBefore = await paymentTokenContract.balanceOf(recipient.address);

      await spritzPay.connect(admin).payWithV3Swap(...ethPaymentQuote);

      const paymentTokenBalanceAfter = await paymentTokenContract.balanceOf(recipient.address);

      expect(paymentTokenBalanceAfter.sub(paymentTokenBalanceBefore)).to.eq(ethPaymentQuote[4]);
    });

    it('emits a "Payment" event on successful execution', async () => {
      await expect(spritzPay.connect(admin).payWithV3Swap(...ethPaymentQuote)).to.emit(spritzPay, "Payment");
    });

    it("reduces the balance by the amount spent", async () => {
      const balanceBefore = await defiUser.getBalance();

      const txReceiptUnresolved = await spritzPay.connect(defiUser).payWithV3Swap(...ethPaymentQuote);
      const txReceipt = await txReceiptUnresolved.wait();

      const gasUsed = txReceipt.effectiveGasPrice.mul(txReceipt.gasUsed);
      const paymentEvent = txReceipt.events?.find(({ event }) => event === "Payment");
      const amountSpent = paymentEvent?.args?.sourceTokenAmount;

      const balanceAfter = await defiUser.getBalance();

      expect(balanceBefore.sub(balanceAfter.add(gasUsed))).to.eq(amountSpent);
    });

    it("reverts if the swap does not succeed", async () => {
      const quoteCopy = [...ethPaymentQuote];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      quoteCopy[2] = "12441641062185128575";
      quoteCopy[quoteCopy.length - 1] = { value: "12441641062185128575" };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await expect(spritzPay.connect(admin).payWithV3Swap(...quoteCopy)).to.be.revertedWith("STF");
    });
  });
});
