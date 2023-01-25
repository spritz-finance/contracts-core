import { expect } from "chai";
import { utils } from "ethers";
import { ethers, upgrades, waffle } from "hardhat";

const RECIPIENT = "0x2000000000000000000000000000000000000000";
const SWAP_TARGET = "0x3000000000000000000000000000000000000000";
const WRAPPED_NATIVE = "0x4000000000000000000000000000000000000000";
const ACCEPTED_TOKEN = "0x5000000000000000000000000000000000000000";
const V3_SWAP_TARGET = "0x6000000000000000000000000000000000000000";

const getStorageAddress = async (address: string, slot: number) => {
  const provider = waffle.provider;
  const hexSlot = utils.hexlify(slot);
  const storage = await provider.getStorageAt(address, hexSlot);
  return ethers.utils.hexStripZeros(storage);
};

describe("Upgrade to V3", () => {
  it("successfully upgrade the proxy contract", async () => {
    const [admin] = await ethers.getSigners();
    const SpritzPayV1 = await ethers.getContractFactory("SpritzPayV1");
    const SpritzPayV2 = await ethers.getContractFactory("SpritzPayV2");
    const SpritzPayV3 = await ethers.getContractFactory("SpritzPayV3");

    const instance = await upgrades.deployProxy(SpritzPayV1, [
      admin.address,
      RECIPIENT,
      SWAP_TARGET,
      WRAPPED_NATIVE,
      [ACCEPTED_TOKEN],
    ]);
    await instance.deployed();

    let paymentRecipient = await instance.paymentRecipient();
    expect(paymentRecipient).to.eq(RECIPIENT);

    let swapTarget = await instance.swapTarget();
    expect(swapTarget).to.eq(SWAP_TARGET);

    let wrappedEther = await getStorageAddress(instance.address, 303);
    expect(wrappedEther).to.eq(WRAPPED_NATIVE);

    const upgradedV2 = await upgrades.upgradeProxy(instance.address, SpritzPayV2);

    /**
     * Validate major storage slots
     */
    paymentRecipient = await upgradedV2.paymentRecipient();
    expect(paymentRecipient).to.eq(RECIPIENT);

    swapTarget = await upgradedV2.swapTarget();
    expect(swapTarget).to.eq(SWAP_TARGET);

    wrappedEther = await getStorageAddress(instance.address, 303);
    expect(wrappedEther).to.eq(WRAPPED_NATIVE);

    /**
     * Initialising new storage variable
     */
    let v3Address = await getStorageAddress(instance.address, 306);
    expect(v3Address).to.eq("0x");

    await upgradedV2.connect(admin).setV3SwapTarget(V3_SWAP_TARGET);

    v3Address = await getStorageAddress(instance.address, 306);
    expect(v3Address).to.eq(V3_SWAP_TARGET);

    const upgradedV3 = await upgrades.upgradeProxy(instance.address, SpritzPayV3);

    /**
     * Validate major storage slots
     */
    paymentRecipient = await upgradedV3.paymentRecipient();
    expect(paymentRecipient).to.eq(RECIPIENT);

    swapTarget = await upgradedV3.swapTarget();
    expect(swapTarget).to.eq(SWAP_TARGET);

    wrappedEther = await getStorageAddress(instance.address, 303);
    expect(wrappedEther).to.eq(WRAPPED_NATIVE);
  });
});
