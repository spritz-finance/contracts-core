import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

import { IERC20Upgradeable, SpritzBridgeV2, SpritzBridgeV2__factory } from "../../src/types";
import { getERC20Contracts } from "../helpers/helpers";

const BSC_USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
const BSC_USDC_DECIMALS = 18;

describe("SpritzBridgeV2", function () {
  let usdcWhale: SignerWithAddress;
  let admin: SignerWithAddress;
  let bridgeFactory: SpritzBridgeV2__factory;
  this.timeout(10000000);

  const TREASURY_WALLET = "0xC812d763b1b17F7ceF189F50A0a8C2d9419852E3";
  const BRIDGE_BOT = "0x79f02cB9C54c3C07D4f6510910a9849Fa8DdA0c1";
  const JUMPER_BRIDGE_ADDRESS = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
  const deployArgs: [string, string, string] = [TREASURY_WALLET, BRIDGE_BOT, JUMPER_BRIDGE_ADDRESS];

  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  this.beforeAll(async () => {
    usdcWhale = await impersonateAccount("0xF106404fa7Efc0471490266b5974EF009Cd95d13");
    bridgeFactory = (await ethers.getContractFactory("SpritzBridgeV2")) as SpritzBridgeV2__factory;
    const [_admin] = await ethers.getSigners();
    admin = _admin;
  });

  describe("Deployment", () => {
    it("deploys", async () => {
      (await bridgeFactory.deploy(...deployArgs)) as SpritzBridgeV2;
    });
  });

  describe("Bridging", () => {
    let bridge: SpritzBridgeV2;
    const usdcAmount = ethers.utils.parseUnits("1000", BSC_USDC_DECIMALS);
    let usdc: IERC20Upgradeable;

    beforeEach(async () => {
      await admin.sendTransaction({
        to: usdcWhale.address,
        value: ethers.utils.parseEther("100"),
      });
      bridge = await bridgeFactory.deploy(...deployArgs);
      const [_usdc] = (await getERC20Contracts([BSC_USDC])) as [IERC20Upgradeable];
      usdc = _usdc;
    });

    it("bridges usdc from bsc to polygon", async () => {
      const params = {
        data: "0xb506907100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000200afcbcf49dae9444092935739807e7cd96880f07cc49f513af89c47f7feb6a0250000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008ac76a51cc950d9822d68b83fe1ad97b32cd580d0000000000000000000000004b7d6c3cea01f4d54a9cad6587da106ea39da1e60000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000089000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006616d61726f6b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000086c6966692d61706900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000004b7d6c3cea01f4d54a9cad6587da106ea39da1e60000000000000000000000000000000000000000000000000000f0f6c6870e3d00000000000000000000000000000000000000000000000000000000000000320000000000000000000000004b7d6c3cea01f4d54a9cad6587da106ea39da1e600000000000000000000000000000000000000000000000000000000706f6c790000000000000000000000000000000000000000000000000000000000000000",
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        value: "0xf0f6c6870e3d",
        from: "0x0d804Ba29EA121b6a4b57d857556440959f206B2",
        chainId: 56,
        gasPrice: "0xb2d05e00",
        gasLimit: "0x09a443",
      };

      console.log("transferring usdc to bridge");

      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);
      console.log("done transfer");
      const result = await bridge.connect(admin).bridgeToken(BSC_USDC, usdcAmount, params.data, {
        value: params.value,
        gasPrice: params.gasPrice,
        gasLimit: params.gasLimit,
      });
      console.log(result);
      const balanceAfter = await usdc.balanceOf(bridge.address);
      expect(balanceAfter).to.eq(BigNumber.from("999000000000000000000"));
    });
  });
});
