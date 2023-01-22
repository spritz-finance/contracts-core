import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network, tracer } from "hardhat";

import { IERC20Upgradeable, SpritzBridge, SpritzBridge__factory } from "../../src/types";
import { getERC20Contracts } from "../helpers/helpers";

// const multiswapBridgeAddress = "0xd1c5966f9f5ee6881ff6b261bbeda45972b1b5f3";
const BSC_USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";

describe("SpritzBridge", function () {
  let usdcWhale: SignerWithAddress;
  let admin: SignerWithAddress;
  let bridgeFactory: SpritzBridge__factory;
  this.timeout(10000000);

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  this.beforeAll(async () => {
    usdcWhale = await impersonateAccount("0xea9d39a074e531e766dddc974670da250bb9f63d");
    bridgeFactory = (await ethers.getContractFactory("SpritzBridge")) as SpritzBridge__factory;
    const [_admin] = await ethers.getSigners();
    admin = _admin;
  });

  describe("Deployment", () => {
    it("deploys", async () => {
      (await bridgeFactory.deploy()) as SpritzBridge;
    });
  });

  describe("Bridging", () => {
    let bridge: SpritzBridge;
    const USDC_BSC_Decimals = 18;
    const usdcAmount = ethers.utils.parseUnits("1000", USDC_BSC_Decimals); //usdc-bsc 18 dec
    let usdc: IERC20Upgradeable;

    beforeEach(async () => {
      await admin.sendTransaction({
        to: usdcWhale.address,
        value: ethers.utils.parseEther("100"),
      });
      bridge = await bridgeFactory.deploy();
      const [_usdc] = (await getERC20Contracts([BSC_USDC])) as [IERC20Upgradeable];
      usdc = _usdc;
    });

    it("bridges usdc from bsc to polygon", async () => {
      console.log(ethers.utils.parseUnits("12", 18));

      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await bridge.connect(admin).bridgeUDSCToPolygon(usdcAmount);
      const balanceAfter = await usdc.balanceOf(bridge.address);
      expect(balanceAfter).to.eq(BigNumber.from(0));
    });

    it("reverts on too much", async () => {
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await expect(bridge.connect(admin).bridgeUDSCToPolygon(usdcAmount.mul(2))).to.be.revertedWith(
        "Amount exceeds balance",
      );
    });

    it("reverts on too little", async () => {
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await expect(
        bridge.connect(admin).bridgeUDSCToPolygon(ethers.utils.parseUnits("1", USDC_BSC_Decimals)),
      ).to.be.revertedWith("Amount less than minimum");
    });
  });
});
