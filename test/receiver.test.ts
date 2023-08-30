import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SpritzReceiverFactory } from "../src/types";

describe.only("SpritzReceiver", function () {
  let controller: SignerWithAddress;
  let deployer: SignerWithAddress;
  let spritzPayAdmin: SignerWithAddress;
  let receiverDeployer: SpritzReceiverFactory;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    controller = signers[0];
    deployer = signers[1];
    spritzPayAdmin = signers[2];

    const receiverDeployerFactory = await ethers.getContractFactory("SpritzReceiverFactory");
    receiverDeployer = await receiverDeployerFactory
      .connect(deployer)
      .deploy(controller.address, spritzPayAdmin.address);
  });

  it("deploys a SpritzReceiver and prevents subsequent deployments", async function () {
    const reference = ethers.utils.keccak256("0x64ec54b6a7ab473f7713b63a");

    const deployTx = await receiverDeployer.connect(deployer).deploy(reference);
    await deployTx.wait();

    await expect(receiverDeployer.connect(deployer).deploy(reference)).to.be.revertedWith("Create2: Failed on deploy");
  });
});
