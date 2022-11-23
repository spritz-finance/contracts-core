import { BaseProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Network, SpritzPaySDK } from "@spritz-finance/sdk";
import { loadFixture } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import { SpritzPayV1 } from "../../src/types";
import {
  ACCEPTED_STABLECOINS_POLYGON,
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  USDC_POLYGON_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "../../tasks/deploy/constants";
import {
  MIMATIC_POLYGON_ADDRESS,
  USDC_WHALE_ADDRESS,
  WBTC_HOLDER_ADDRESS,
  WBTC_POLYGON_ADDRESS,
} from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";

const tokenAddress = USDC_POLYGON_ADDRESS;
const reference = "6304ca0d2f5acf6d69b3c58e";
// const formattedReference = formatPaymentReference(reference);
const DUMP_ADDRESS = "0x1000000000000000000000000000000000000000";

describe("SpritzPay", function () {
  this.timeout(10000000);

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  async function clearBalance(token: string, holder: SignerWithAddress) {
    const [contract] = await getERC20Contracts([token]);
    const balance = await contract.balanceOf(holder.address);
    if (!balance.isZero()) {
      await contract.connect(holder).transfer(DUMP_ADDRESS, balance);
    }
  }

  async function setupFixture() {
    // const signers = await ethers.getSigners();
    // const admin = signers[0];
    // const recipient = signers[1];
    // const usdcWhale = await impersonateAccount(USDC_WHALE_ADDRESS);
    // const defiUser = await impersonateAccount(WBTC_HOLDER_ADDRESS);
    const provider = ethers.getDefaultProvider();
    console.log(provider);
    const sdk = new SpritzPaySDK({
      network: Network.Polygon,
      provider: provider,
      staging: true,
    });

    // const spritzPayFactory = await ethers.getContractFactory("SpritzPayV2");
    // const spritzPay = (await upgrades.deployProxy(spritzPayFactory, [
    //   admin.address,
    //   recipient.address,
    //   QUICKSWAP_ROUTER_POLYGON_ADDRESS,
    //   WMATIC_POLYGON_ADDRESS,
    //   ACCEPTED_STABLECOINS_POLYGON,
    // ])) as SpritzPayV1;

    // await spritzPay.deployed();
    // await clearBalance(tokenAddress, recipient);

    return { sdk };
  }

  describe.only("payWithV3Swap", () => {
    it("reverts if the contract has been paused", async () => {
      const { sdk } = await loadFixture(setupFixture);

      //   const [wbtcTokenContract] = await getERC20Contracts([WBTC_POLYGON_ADDRESS]);
      //   await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);
      //   await spritzPay.pause();

      const { args } = await sdk.getV3SwapPaymentData(MIMATIC_POLYGON_ADDRESS, 10, reference);
      console.log({ args });
      //   await expect(
      //     spritzPay.connect(defiUser).payWithSwap(...(args as Parameters<SpritzPayV1["functions"]["payWithSwap"]>)),
      //   ).to.be.revertedWith("Pausable: paused");
    });

    //     it("should swap token for token and emit a payment event", async () => {
    //       const { args } = await sdk.getPaymentArgs(WBTC_POLYGON_ADDRESS, 10, reference);

    //       const tokenBAddress = args[0][args[0].length - 1];

    //       await clearBalance(tokenBAddress, recipient);

    //       const [wbtcTokenContract, tokenBContract] = await getERC20Contracts([WBTC_POLYGON_ADDRESS, tokenBAddress]);
    //       await wbtcTokenContract.connect(defiUser).approve(spritzPay.address, 1000000000000000);

    //       const result = await spritzPay
    //         .connect(defiUser)
    //         .payWithSwap(...(args as Parameters<SpritzPayV1["functions"]["payWithSwap"]>));

    //       const recipientBalanceAfter = await tokenBContract.balanceOf(recipient.address);
    //       expect(recipientBalanceAfter).to.eq(args[2]);

    //       await expect(result)
    //         .to.emit(spritzPay, "Payment")
    //         .withArgs(
    //           recipient.address,
    //           defiUser.address,
    //           args[0][0],
    //           anyValue,
    //           tokenBAddress,
    //           args[2],
    //           formattedReference,
    //         );
    //     });

    //     it("should swap native for token and emit an event", async () => {
    //       const { args } = await sdk.getPaymentArgs(NATIVE_ZERO_ADDRESS, 1, reference);
    //       const tokenBAddress = args[0][args[0].length - 1];

    //       await clearBalance(tokenBAddress, recipient);

    //       const [tokenBContract] = await getERC20Contracts([tokenBAddress]);

    //       const result = await spritzPay
    //         .connect(defiUser)
    //         .payWithSwap(...(args as Parameters<SpritzPayV1["functions"]["payWithSwap"]>));

    //       const recipientBalanceAfter = await tokenBContract.balanceOf(recipient.address);
    //       expect(recipientBalanceAfter).to.eq(args[2]);

    //       await expect(result)
    //         .to.emit(spritzPay, "Payment")
    //         .withArgs(
    //           recipient.address,
    //           defiUser.address,
    //           args[0][0],
    //           anyValue,
    //           tokenBAddress,
    //           args[2],
    //           formattedReference,
    //         );
    //     });
  });

  //   describe("pausability", () => {
  //     it("only allows the owner to pause the contract", async () => {
  //       await expect(spritzPay.connect(usdcWhale).pause()).to.be.revertedWith("AccessControl");
  //     });

  //     it("only allows the owner to unpause the contract", async () => {
  //       await expect(spritzPay.connect(usdcWhale).unpause()).to.be.revertedWith("AccessControl");
  //     });
  //   });
});
