import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

import { IERC20Upgradeable, SpritzBridge, SpritzBridge__factory } from "../../src/types";
import { getERC20Contracts } from "../helpers/helpers";

const BSC_USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
const BSC_USDC_DECIMALS = 18;

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
    const usdcAmount = ethers.utils.parseUnits("1000", BSC_USDC_DECIMALS);
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

    const setupBridge = async () => {
      await bridge
        .connect(admin)
        .setBridgeParamsForToken(
          BSC_USDC,
          137,
          "0xd1C5966f9F5Ee6881Ff6b261BBeDa45972B1B5f3",
          "0x8965349fb649A33a30cbFDa057D8eC2C48AbE2A2",
          ethers.utils.parseUnits("12", BSC_USDC_DECIMALS),
          "0x4b7D6C3cEa01F4d54A9cad6587DA106Ea39dA1e6",
          true,
        );
    };

    it("reverts if bridging params were not set up", async () => {
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await expect(bridge.connect(admin).bridgeToken(BSC_USDC, usdcAmount)).to.be.revertedWith(
        "Bridging params not found",
      );
    });

    it("bridges usdc from bsc to polygon", async () => {
      await setupBridge();

      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await bridge.connect(admin).bridgeToken(BSC_USDC, usdcAmount);
      const balanceAfter = await usdc.balanceOf(bridge.address);
      expect(balanceAfter).to.eq(BigNumber.from(0));
    });

    it("reverts on too much", async () => {
      await setupBridge();
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await expect(bridge.connect(admin).bridgeToken(BSC_USDC, usdcAmount.mul(2))).to.be.revertedWith(
        "Amount exceeds balance",
      );
    });

    it("reverts on too little", async () => {
      await setupBridge();
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      await expect(
        bridge.connect(admin).bridgeToken(BSC_USDC, ethers.utils.parseUnits("1", BSC_USDC_DECIMALS)),
      ).to.be.revertedWith("Amount less than minimum");
    });
  });
});
