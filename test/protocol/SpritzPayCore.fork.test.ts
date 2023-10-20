/* eslint-disable @typescript-eslint/no-unused-vars */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers, network } from "hardhat";

import { SpritzPayCore, SpritzPayCore__factory } from "../../src/types";
import { IERC20 } from "../../src/types/openzeppelin-5/token/ERC20";
import { getERC20Contracts } from "../helpers/helpers";

const reference = ethers.utils.keccak256("0x64ec54b6a7ab473f7713b63a");

export const getPaymentEvent = async (txReceipt: ContractTransaction) => {
  const tx = await txReceipt.wait();
  const eventArgs = tx.events?.[1].args ?? null;
  expect(eventArgs).not.to.be.null;
  return {
    to: eventArgs?.["to"],
    from: eventArgs?.["from"],
    sourceToken: eventArgs?.["sourceToken"],
    sourceTokenAmount: eventArgs?.["sourceTokenAmount"],
    paymentToken: eventArgs?.["paymentToken"],
    paymentTokenAmount: eventArgs?.["paymentTokenAmount"],
    paymentReference: eventArgs?.["paymentReference"],
  };
};

async function impersonateAccount(acctAddress: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  return await ethers.getSigner(acctAddress);
}

const USDC_POLYGON = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
const USDC_WHALE = "0x166716c2838e182d64886135a96f1aabca9a9756";

const setupFactoryFixture = async () => {
  const [deployer, admin, recipient] = await ethers.getSigners();

  const SpritzPayFactory = (await ethers.getContractFactory("SpritzPayCore")) as SpritzPayCore__factory;
  const spritzPay = (await SpritzPayFactory.connect(deployer).deploy(admin.address)) as SpritzPayCore;
  await spritzPay.deployed();

  const [usdc] = (await getERC20Contracts([USDC_POLYGON])) as [IERC20];

  const usdcWhale = await impersonateAccount(USDC_WHALE);

  return {
    spritzPay,
    admin,
    recipient,
    usdcWhale,
    usdc,
  };
};

describe("SpritzPayCore", function () {
  let recipient: SignerWithAddress;
  let admin: SignerWithAddress;
  let usdcWhale: SignerWithAddress;
  let usdc: IERC20;
  let spritzPay: SpritzPayCore;

  beforeEach(async () => {
    ({ admin, spritzPay, recipient, usdcWhale, usdc } = await loadFixture(setupFactoryFixture));
  });

  it("reverts if not enough balance has been transferred to the contract", async function () {
    const USDC_AMOUNT = 1000;
    await spritzPay.connect(admin).addPaymentToken(USDC_POLYGON);
    await spritzPay.connect(admin).setPaymentRecipient(recipient.address);

    await expect(
      spritzPay.pay(admin.address, USDC_POLYGON, USDC_AMOUNT, USDC_POLYGON, USDC_AMOUNT, reference),
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("emits a payment event if the transfer is successful", async function () {
    const USDC_AMOUNT = 1000;

    await spritzPay.connect(admin).addPaymentToken(USDC_POLYGON);
    await spritzPay.connect(admin).setPaymentRecipient(recipient.address);

    await usdc.connect(usdcWhale).transfer(spritzPay.address, USDC_AMOUNT);

    const tx = await spritzPay.pay(admin.address, USDC_POLYGON, USDC_AMOUNT, USDC_POLYGON, USDC_AMOUNT, reference);
    const event = await getPaymentEvent(tx);

    expect(event.paymentTokenAmount).to.eq(USDC_AMOUNT);
  });
});
