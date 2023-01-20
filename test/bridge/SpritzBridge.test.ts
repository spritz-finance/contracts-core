import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import axios from "axios";
import { ethers, network } from "hardhat";

import { SpritzBridge, SpritzBridge__factory } from "../../src/types";
import { getERC20Contracts } from "../helpers/helpers";

const multiswapBridgeAddress = "0xd1c5966f9f5ee6881ff6b261bbeda45972b1b5f3";
const BSC_USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
const targetWallet = "0xc812d763b1b17f7cef189f50a0a8c2d9419852e3";

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
    before(async () => {
      await admin.sendTransaction({
        to: usdcWhale.address,
        value: ethers.utils.parseEther("100"),
      });
    });

    async function getQuote(token: string, chainId: string, targetChainId: string) {
      const { data } = await axios.get<Record<string, any>>(
        `https://bridgeapi.multichain.org/v4/tokenlistv4/${chainId}`,
      );
      for (const src of Object.values(data)) {
        if (src.address !== token.toLowerCase()) {
          continue;
        }

        // console.log(v);

        const destChainObj = src.destChains[targetChainId];

        if (!destChainObj) throw new Error("No quote");

        //yes?
        const dest = Object.values(destChainObj)[0] as any;

        if (!dest) throw new Error("No quote");

        const isUnderlying = !!dest.routerABI.match(/anySwapOutUnderlying/);

        return {
          isUnderlying,
          swapToken: dest.fromanytoken.address,
          dest,
        };
      }

      throw new Error("No quote");
    }

    it("bridges usdc from bsc to polygon", async () => {
      const bridge = await bridgeFactory.deploy(multiswapBridgeAddress);
      const [usdc] = await getERC20Contracts([BSC_USDC]);

      //fetch data for bridge
      const { dest, isUnderlying, swapToken } = (await getQuote(usdc.address, "56", "137")) as any;

      console.log("Bridging data", dest);

      //give the bridge some usdc
      const usdcAmount = ethers.utils.parseUnits("1000", 18); //usdc-bsc 18 dec
      await usdc.connect(usdcWhale).transfer(bridge.address, usdcAmount);

      const result = await bridge
        .connect(admin)
        .bridge(usdc.address, swapToken, targetWallet, usdcAmount, 137, isUnderlying);

      console.log(result);
    });
  });
});
