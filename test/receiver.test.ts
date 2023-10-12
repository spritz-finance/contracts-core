/* eslint-disable @typescript-eslint/no-unused-vars */
import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { BaseContract, BigNumber, ContractTransaction, utils } from "ethers";
import { ethers } from "hardhat";

import {
  ParaswapExactInDelegateModule,
  ParaswapExactInDelegateModule__factory,
  SpritzPayV3,
  SpritzPayV3__factory,
  SpritzReceiver,
  SpritzReceiverFactory,
  SpritzReceiverFactory__factory,
} from "../src/types";
import augustusRegistryAbi from "./abi/augustusRegistry.json";
import augustusSwapperAbi from "./abi/augustusSwapper.json";
import erc20Abi from "./abi/erc20.json";
import wethAbi from "./abi/weth.json";

chai.use(smock.matchers);

const DEALINE = 199999999;
const WMATIC_POLYGON_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

const getDeployDataFromEvent = async (txReceipt: ContractTransaction) => {
  const tx = await txReceipt.wait();
  const eventArgs = tx.events?.[0].args ?? null;
  expect(eventArgs).not.to.be.null;
  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    deployedAddress: eventArgs!["deployedAddress"],
  };
};

const encodeSwapData = (bytes: string, to: string, srcToken: string, destToken: string) =>
  utils.defaultAbiCoder.encode(["bytes", "address", "address", "address"], [bytes, to, srcToken, destToken]);

const setupFactoryFixture = async () => {
  const [controller, deployer, spritzPayAdmin, tokenTransferProxy] = await ethers.getSigners();

  const ReceiverFactory = (await ethers.getContractFactory("SpritzReceiverFactory")) as SpritzReceiverFactory__factory;
  const receiverFactory = (await ReceiverFactory.connect(deployer).deploy(controller.address)) as SpritzReceiverFactory;
  await receiverFactory.deployed();

  const SpritzPay = (await ethers.getContractFactory("SpritzPayV3")) as SpritzPayV3__factory;
  const spritzPay = (await smock.fake(SpritzPay)) as FakeContract<SpritzPayV3>;

  const augustusRegistry = await smock.fake(augustusRegistryAbi);
  const augustusSwapper = await smock.fake(augustusSwapperAbi);
  const inputToken = (await smock.fake(erc20Abi)) as FakeContract<BaseContract>;
  const outputToken = (await smock.fake(erc20Abi)) as FakeContract<BaseContract>;
  const weth = await smock.fake(wethAbi);

  augustusRegistry.isValidAugustus.whenCalledWith(augustusSwapper.address).returns(true);
  augustusSwapper.getTokenTransferProxy.returns(tokenTransferProxy.address);

  inputToken.approve.returns(true);
  weth.approve.returns(true);

  const SwapModuleFactory = (await ethers.getContractFactory(
    "ParaswapExactInDelegateModule",
  )) as ParaswapExactInDelegateModule__factory;
  const swapModule = (await SwapModuleFactory.deploy(
    augustusRegistry.address,
    weth.address,
  )) as ParaswapExactInDelegateModule;
  await swapModule.deployed();

  await receiverFactory.connect(deployer).initialize(spritzPayAdmin.address, spritzPay.address, swapModule.address);

  const reference = ethers.utils.keccak256("0x64ec54b6a7ab473f7713b63a");

  const deployTx = await receiverFactory.connect(controller).deploy(reference);
  await deployTx.wait();

  const { deployedAddress } = await getDeployDataFromEvent(deployTx);

  const testReceiver = await ethers.getContractAt("SpritzReceiver", deployedAddress);

  return {
    controller,
    deployer,
    receiverFactory,
    swapModule,
    spritzPayAdmin,
    spritzPay,
    testReceiver,
    reference,
    augustusRegistry,
    augustusSwapper,
    inputToken,
    outputToken,
    weth,
  };
};

describe.only("SpritzReceiver", function () {
  let controller: SignerWithAddress;
  let deployer: SignerWithAddress;
  let spritzPay: FakeContract<SpritzPayV3>;
  let augustusSwapper: FakeContract<BaseContract>;
  let weth: FakeContract<BaseContract>;
  let inputToken: FakeContract<BaseContract>;
  let outputToken: FakeContract<BaseContract>;
  let receiverFactory: SpritzReceiverFactory;
  let swapModule: ParaswapExactInDelegateModule;
  let testReceiver: SpritzReceiver;
  let reference: string;

  beforeEach(async () => {
    ({
      controller,
      deployer,
      receiverFactory,
      swapModule,
      spritzPay,
      testReceiver,
      reference,
      augustusSwapper,
      inputToken,
      outputToken,
      weth,
    } = await loadFixture(setupFactoryFixture));
    outputToken.balanceOf.reset();
    weth.deposit.reset();
    spritzPay.payWithToken.reset();
    spritzPay.payWithSwap.reset();
  });

  it("deploys a SpritzReceiver and prevents subsequent deployments", async function () {
    const contractReference = ethers.utils.keccak256("0x54ec54b6a7ab473f7713b63a");

    const deployTx = await receiverFactory.connect(controller).deploy(contractReference);
    await deployTx.wait();

    await expect(receiverFactory.connect(controller).deploy(contractReference)).to.be.revertedWith(
      "Create2: Failed on deploy",
    );
  });

  it("only allows the controller address to call the payWithToken method", async function () {
    await expect(
      testReceiver.connect(deployer).payWithToken(WMATIC_POLYGON_ADDRESS, 1000),
    ).to.be.revertedWithCustomError(testReceiver, "NotController");
  });

  it("allows the controller address to call the payWithToken method", async function () {
    await expect(
      testReceiver.connect(controller).payWithToken(WMATIC_POLYGON_ADDRESS, 1000),
    ).not.to.be.revertedWithCustomError(testReceiver, "NotController");
  });

  it("payWithToken calls SpritzPay with the correct arguments", async function () {
    await testReceiver.connect(controller).payWithToken(WMATIC_POLYGON_ADDRESS, 1000);

    expect(spritzPay.payWithToken).to.have.been.calledWith(WMATIC_POLYGON_ADDRESS, 1000, reference);
  });

  it("only allows the controller address to call the payWithSwap method", async function () {
    await expect(
      testReceiver.connect(deployer).payWithSwap(WMATIC_POLYGON_ADDRESS, 1000, 199999999, reference),
    ).to.be.revertedWithCustomError(testReceiver, "NotController");
  });

  it("fails to decode arbitrary bytes data in payWithSwap", async function () {
    await expect(
      testReceiver.connect(controller).payWithSwap(WMATIC_POLYGON_ADDRESS, 1000, 199999999, reference),
    ).to.be.revertedWithCustomError(testReceiver, "DecodeFailure");
  });

  it("successfully processes a token swap", async function () {
    const balanceAfterSwap = 1000;

    const swapData = encodeSwapData("0x00", augustusSwapper.address, inputToken.address, outputToken.address);

    inputToken.balanceOf.whenCalledWith(testReceiver.address).returns(1000);

    outputToken.balanceOf.whenCalledWith(testReceiver.address).returns(0);
    outputToken.balanceOf.returnsAtCall(1, balanceAfterSwap);

    await testReceiver.connect(controller).payWithSwap(1000, 1000, DEALINE, swapData);

    expect(spritzPay.payWithToken).to.have.been.calledWith(outputToken.address, balanceAfterSwap, reference);
  });

  it("successfully processes a native token swap", async function () {
    const balanceAfterSwap = 1000;

    const swapData = encodeSwapData("0x00", augustusSwapper.address, weth.address, outputToken.address);

    await controller.sendTransaction({
      to: testReceiver.address,
      value: 1000,
    });

    weth.balanceOf.whenCalledWith(testReceiver.address).returns(1000);

    outputToken.balanceOf.returnsAtCall(0, 0);
    outputToken.balanceOf.returnsAtCall(1, balanceAfterSwap);

    await testReceiver.connect(controller).payWithSwap(1000, 1000, DEALINE, swapData);

    expect(weth.deposit).to.have.been.calledWithValue(BigNumber.from(1000));
    expect(spritzPay.payWithToken).to.have.been.calledWith(outputToken.address, balanceAfterSwap, reference);
  });

  it("successfully processes a weth token swap", async function () {
    const balanceAfterSwap = 1000;

    const swapData = encodeSwapData("0x00", augustusSwapper.address, weth.address, outputToken.address);

    weth.balanceOf.whenCalledWith(testReceiver.address).returns(1000);

    outputToken.balanceOf.returnsAtCall(0, 0);
    outputToken.balanceOf.returnsAtCall(1, balanceAfterSwap);

    await testReceiver.connect(controller).payWithSwap(1000, 1000, DEALINE, swapData);

    expect(weth.deposit).not.to.have.been.called;
    expect(spritzPay.payWithToken).to.have.been.calledWith(outputToken.address, balanceAfterSwap, reference);
  });

  it("reverts if swap output is less than minimum amount", async function () {
    const minOut = 1000;
    const swapData = encodeSwapData("0x00", augustusSwapper.address, inputToken.address, outputToken.address);

    inputToken.balanceOf.whenCalledWith(testReceiver.address).returns(1000);

    outputToken.balanceOf.returnsAtCall(0, 0);
    outputToken.balanceOf.returnsAtCall(1, minOut - 100);
    1;
    await expect(
      testReceiver.connect(controller).payWithSwap(1000, minOut, DEALINE, swapData),
    ).to.be.revertedWithCustomError(swapModule, "InvalidSwapOutput");
  });
});
