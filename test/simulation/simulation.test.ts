import { ethers, network } from "hardhat";

import { FORKING_CHAIN } from "../../hardhat.config";
import {
  QUICKSWAP_ROUTER_POLYGON_ADDRESS,
  UNISWAP_V3_ROUTER_ADDRESS,
  USDC_MAINNET_ADDRESS,
  USDC_POLYGON_ADDRESS,
  WETH_MAINNET_ADDRESS,
  WMATIC_POLYGON_ADDRESS,
} from "../../tasks/deploy/constants";
import { getERC20Contracts } from "../helpers/helpers";

const simulationConfig = {
  "polygon-mainnet": {
    paymentTokenAddress: USDC_POLYGON_ADDRESS,
    v2RouterAddress: QUICKSWAP_ROUTER_POLYGON_ADDRESS,
    nativeAddress: WMATIC_POLYGON_ADDRESS,
  },
  mainnet: {
    paymentTokenAddress: USDC_MAINNET_ADDRESS,
    v2RouterAddress: UNISWAP_V3_ROUTER_ADDRESS,
    nativeAddress: WETH_MAINNET_ADDRESS,
  },
};

const IMPERSONATION_ADDRESS = "0x5e33ba4f6d5150fe7aa16fccfd77b2b8047163f7";
// const reference = "6304ca0d2f5acf6d69b3c58e";
// const formattedReference = formatPaymentReference(reference);

describe.only("production simulation", () => {
  async function impersonateAccount(acctAddress: string) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    return await ethers.getSigner(acctAddress);
  }

  it("pays with token", async () => {
    const config = simulationConfig[FORKING_CHAIN];
    // const [paymentTokenContract] = await getERC20Contracts([config.paymentTokenAddress]);
    const [admin, recipient] = await ethers.getSigners();

    const user = await impersonateAccount(IMPERSONATION_ADDRESS);
    const SpritzPayFactory = await ethers.getContractFactory("SpritzPayV2");

    const spritzPay = await SpritzPayFactory.deploy();
    await spritzPay.initialize(admin.address, recipient.address, config.v2RouterAddress, config.nativeAddress, [
      config.paymentTokenAddress,
    ]);
    await spritzPay.setV3SwapTarget(config.v2RouterAddress);

    // await paymentTokenContract.connect(user).approve(spritzPay.address, "1000000000000000000000000000000000000000000");
    const balance = await user.getBalance();
    console.log({ balance, formatted: ethers.utils.formatEther(balance) });

    const tz = await user.sendTransaction({
      to: spritzPay.address,
      data: "0xa4d819f600000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000003795fcb3aab6acd000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000123ae690000000000000000000000000000000000000000063906743fca65f8dac40207300000000000000000000000000000000000000000000000000000184ec136501000000000000000000000000000000000000000000000000000000000000002ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000",
      value: ethers.utils.parseEther("0.250336580763085517"),
      gasLimit: 520000,
      gasPrice: 17549568276,
    });
    const x = await tz.wait();
    console.log(x);
  });
});
