/* eslint-disable @typescript-eslint/no-unused-vars */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SpritzPayCore, SpritzPayCore__factory } from "../../src/types";

const setupFactoryFixture = async () => {
  const [controller, deployer, admin] = await ethers.getSigners();

  const ReceiverFactory = (await ethers.getContractFactory("SpritzPayCore")) as SpritzPayCore__factory;
  const spritzPay = (await ReceiverFactory.connect(deployer).deploy(admin.address)) as SpritzPayCore;
  await spritzPay.deployed();

  return {
    controller,
    deployer,
    spritzPay,
  };
};

describe.only("SpritzPayCore", function () {
  let controller: SignerWithAddress;
  let deployer: SignerWithAddress;
  let spritzPay: SpritzPayCore;

  beforeEach(async () => {
    ({ controller, deployer, spritzPay } = await loadFixture(setupFactoryFixture));
  });

  it("prevents deployments if the salt does not contain the caller address", async function () {});
});
