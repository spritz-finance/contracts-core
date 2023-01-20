import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";

import { SpritzBridge, SpritzBridge__factory } from "../../src/types";
import { getERC20Contracts } from "../helpers/helpers";

const multiswapBridgeAddress = "0xd1c5966f9f5ee6881ff6b261bbeda45972b1b5f3";
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
      (await bridgeFactory.deploy(multiswapBridgeAddress)) as SpritzBridge;
    });
  });

  describe("Bridging", () => {
    it("bridges usdc", async () => {
      const bridge = (await bridgeFactory.deploy(multiswapBridgeAddress)) as SpritzBridge;

      //send usdc to bridge
      const [usdc] = await getERC20Contracts([BSC_USDC]);

      await admin.sendTransaction({
        to: usdcWhale.address,
        value: ethers.utils.parseEther("100"),
      });

      const usdcBalance = ethers.utils.parseUnits("100", 18); //usdc-bsc 18 dec

      await usdc.connect(usdcWhale).transfer(bridge.address, usdcBalance);

      console.log("bridge has: " + ethers.utils.formatUnits(await usdc.balanceOf(bridge.address), 18));

      const result = await bridge
        .connect(admin)
        .bridge(
          usdc.address,
          "0x8965349fb649A33a30cbFDa057D8eC2C48AbE2A2",
          "0xc812d763b1b17f7cef189f50a0a8c2d9419852e3",
          usdcBalance,
          137,
        );

      console.log(result);
    });
  });
});
