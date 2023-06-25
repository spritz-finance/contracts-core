import { BaseProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Network, SpritzPayV3SDK, USDC_POLYGON } from "@spritz-finance/sdk";
import { expect } from "chai";
import { utils } from "ethers";
import { ethers, network } from "hardhat";

import { IERC20Upgradeable, ParaswapModule, ParaswapModule__factory } from "../../src/types";
import { LINK_WHALE_POLYGON, WMATIC_POLYGON_ADDRESS } from "../helpers/constants";
import { getERC20Contracts } from "../helpers/helpers";

async function impersonateAccount(acctAddress: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  return await ethers.getSigner(acctAddress);
}

const REFERENCE = "6304ca0d2f5acf6d69b3c58e";

const LINK_POLYGON = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";
const PARASWAP_REGISTRY_POLYGON = "0xca35a4866747Ff7A604EF7a2A7F246bb870f3ca1";
const WETH_POLYGON = WMATIC_POLYGON_ADDRESS;

describe("ParaswapModule", function () {
  this.timeout(10000000);
  let admin: SignerWithAddress;
  let sdk: SpritzPayV3SDK;
  let paraswapModule: ParaswapModule;
  let swapper: SignerWithAddress;
  let recipient: SignerWithAddress;
  let linkContract: IERC20Upgradeable;
  let usdcContract: IERC20Upgradeable;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    admin = signers[0];
    recipient = signers[1];

    sdk = new SpritzPayV3SDK({
      network: Network.Polygon,
      provider: admin.provider as BaseProvider,
      staging: true,
    });

    const ParaswapModuleFactory = (await ethers.getContractFactory("ParaswapModule")) as ParaswapModule__factory;
    paraswapModule = await ParaswapModuleFactory.deploy(PARASWAP_REGISTRY_POLYGON, WETH_POLYGON);
    await paraswapModule.deployed();
    [linkContract, usdcContract] = await getERC20Contracts([LINK_POLYGON, USDC_POLYGON.address]);
    swapper = await impersonateAccount(LINK_WHALE_POLYGON);
  });

  it("correctly performs an exact output swap", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 120, paraswapModule.address, REFERENCE);

    const recipientTokenBalanceBefore = await usdcContract.balanceOf(recipient.address);

    await linkContract.connect(swapper).transfer(paraswapModule.address, data.sourceTokenAmountMax);

    await paraswapModule.connect(swapper).exactOutputSwap({
      to: recipient.address,
      from: swapper.address,
      inputTokenAmountMax: data.sourceTokenAmountMax,
      paymentTokenAmount: data.paymentTokenAmount,
      deadline: data.deadline,
      swapData: data.path,
    });

    const recipientTokenBalanceAfter = await usdcContract.balanceOf(recipient.address);
    expect(recipientTokenBalanceAfter.sub(recipientTokenBalanceBefore)).to.eq(data.paymentTokenAmount);
  });

  it("should revert if funds are not sent to the swap module", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    await expect(
      paraswapModule.connect(swapper).exactOutputSwap({
        to: recipient.address,
        from: swapper.address,
        inputTokenAmountMax: data.sourceTokenAmountMax,
        paymentTokenAmount: data.paymentTokenAmount,
        deadline: data.deadline,
        swapData: data.path,
      }),
    ).to.be.revertedWithCustomError(paraswapModule, "InsufficientInputBalance");
  });

  it("should revert if output amount is less than expected", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    await linkContract.connect(swapper).transfer(paraswapModule.address, data.sourceTokenAmountMax);

    await expect(
      paraswapModule.connect(swapper).exactOutputSwap({
        to: recipient.address,
        from: swapper.address,
        inputTokenAmountMax: data.sourceTokenAmountMax,
        paymentTokenAmount: "11000000",
        deadline: data.deadline,
        swapData: data.path,
      }),
    ).to.be.revertedWithCustomError(paraswapModule, "InvalidSwapOutput");
  });

  it("should revert if given an invalid augustus swapper address", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    const swapData = data.path;
    const decoded = utils.defaultAbiCoder.decode(["bytes", "address", "address", "address"], swapData);

    const invalidData = utils.defaultAbiCoder.encode(
      ["bytes", "address", "address", "address"],
      [decoded[0], LINK_POLYGON, decoded[2], decoded[3]],
    );

    await linkContract.connect(swapper).transfer(paraswapModule.address, data.sourceTokenAmountMax);

    await expect(
      paraswapModule.connect(swapper).exactOutputSwap({
        to: recipient.address,
        from: swapper.address,
        inputTokenAmountMax: data.sourceTokenAmountMax,
        paymentTokenAmount: data.paymentTokenAmount,
        deadline: data.deadline,
        swapData: invalidData,
      }),
    ).to.be.revertedWithCustomError(paraswapModule, "InvalidSwapTarget");
  });

  it("should revert if given arbitrary swap data", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    const swapData = data.path;
    const decoded = utils.defaultAbiCoder.decode(["bytes", "address", "address", "address"], swapData);

    const invalidData = utils.defaultAbiCoder.encode(
      ["bytes", "address", "address", "address"],
      ["0x123456789abcdef1", decoded[1], decoded[2], decoded[3]],
    );

    await linkContract.connect(swapper).transfer(paraswapModule.address, data.sourceTokenAmountMax);

    await expect(
      paraswapModule.connect(swapper).exactOutputSwap({
        to: recipient.address,
        from: swapper.address,
        inputTokenAmountMax: data.sourceTokenAmountMax,
        paymentTokenAmount: data.paymentTokenAmount,
        deadline: data.deadline,
        swapData: invalidData,
      }),
    ).to.be.reverted;
  });

  it("should revert if output token address is changed", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    const swapData = data.path;
    const decoded = utils.defaultAbiCoder.decode(["bytes", "address", "address", "address"], swapData);

    const invalidData = utils.defaultAbiCoder.encode(
      ["bytes", "address", "address", "address"],
      [decoded[0], decoded[1], decoded[2], WETH_POLYGON],
    );

    await linkContract.connect(swapper).transfer(paraswapModule.address, data.sourceTokenAmountMax);

    await expect(
      paraswapModule.connect(swapper).exactOutputSwap({
        to: recipient.address,
        from: swapper.address,
        inputTokenAmountMax: data.sourceTokenAmountMax,
        paymentTokenAmount: data.paymentTokenAmount,
        deadline: data.deadline,
        swapData: invalidData,
      }),
    ).to.be.revertedWithCustomError(paraswapModule, "InvalidSwapOutput");
  });

  it("correctly decodes input and output tokens", async () => {
    const { data } = await sdk.getParaswapQuote(LINK_POLYGON, 10, paraswapModule.address, REFERENCE);

    const [inputToken, outputToken] = await paraswapModule.decodeSwapData(data.path);

    expect(inputToken).to.eq(LINK_POLYGON);
    expect(outputToken).to.eq(USDC_POLYGON.address);
  });
});
