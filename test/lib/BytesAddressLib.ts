import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { BytesAddressLibTest, BytesAddressLibTest__factory } from "../../src/types";

const ADDRESS_ONE = "0x690b9a9e9aa1c9db991c7721a92d351db4fac990".toLowerCase();
const ADDRESS_TWO = "0x4675C7e5BaAFBFFbca748158bEcBA61ef3b0a263".toLowerCase();
const ADDRESS_THREE = "0xf2f5c73fa04406b1995e397b55c24ab1f3ea726c".toLowerCase();

const mergeBytesString = (string: string[]) => {
  return string.reduce((acc, curr, index) => {
    if (index === 0) return curr;
    return `${acc}${curr.substring(2)}`;
  }, "");
};

describe("BytesAddressLib", () => {
  async function setupFixture() {
    const LibFactory = (await ethers.getContractFactory("BytesAddressLibTest")) as BytesAddressLibTest__factory;
    const bytesLib = (await LibFactory.deploy()) as BytesAddressLibTest;

    return { bytesLib };
  }

  it("deploys a contract", async () => {
    const { bytesLib } = await loadFixture(setupFixture);
    expect(bytesLib.address).to.be.properAddress;
  });

  describe("toAddressArray", () => {
    it("reverts if passed an invalid bytes string", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      await expect(bytesLib.toAddressArray("0x690b9a9e9aa1c9db9a")).to.be.revertedWith("invalid bytes length");
    });

    it("returns an array with a single address", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const result = await bytesLib.toAddressArray(ADDRESS_ONE);
      expect(result).to.have.length(1);
      expect(result[0].toLowerCase()).to.eq(ADDRESS_ONE);
    });

    it("returns an array with multiple addresses in the correct order", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const result = await bytesLib.toAddressArray(mergeBytesString([ADDRESS_ONE, ADDRESS_TWO]));
      expect(result).to.have.length(2);
      expect(result[0].toLowerCase()).to.eq(ADDRESS_ONE);
      expect(result[1].toLowerCase()).to.eq(ADDRESS_TWO);
    });
  });

  describe("getFirstAddress", () => {
    it("reverts if passed an invalid bytes string", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      await expect(bytesLib.getFirstAddress("0x690b9a9e9aa1c9db9a")).to.be.revertedWith("invalid bytes length");
    });

    it("returns an address if passed only one address", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const result = await bytesLib.getFirstAddress(ADDRESS_ONE);
      expect(result.toLowerCase()).to.eq(ADDRESS_ONE);
    });

    it("returns the first item in a string of multiple addresses", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const first = await bytesLib.getFirstAddress(mergeBytesString([ADDRESS_ONE, ADDRESS_TWO, ADDRESS_THREE]));
      expect(first.toLowerCase()).to.eq(ADDRESS_ONE);

      const second = await bytesLib.getFirstAddress(mergeBytesString([ADDRESS_THREE, ADDRESS_ONE, ADDRESS_TWO]));
      expect(second.toLowerCase()).to.eq(ADDRESS_THREE);
    });

    it("returns the first item in a string of multiple addresses and additional data", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const first = await bytesLib.getFirstAddress(
        mergeBytesString([ADDRESS_ONE, "0x023f", ADDRESS_TWO, "0x023b", ADDRESS_THREE]),
      );
      expect(first.toLowerCase()).to.eq(ADDRESS_ONE);

      const second = await bytesLib.getFirstAddress(
        mergeBytesString([ADDRESS_THREE, "0x023f", ADDRESS_ONE, "0x023b", ADDRESS_TWO]),
      );
      expect(second.toLowerCase()).to.eq(ADDRESS_THREE);
    });
  });

  describe("getLastAddress", () => {
    it("reverts if passed an invalid bytes string", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      await expect(bytesLib.getLastAddress("0x690b9a9e9aa1c9db9a")).to.be.revertedWith("invalid bytes length");
    });

    it("returns an address if passed only one address", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const result = await bytesLib.getLastAddress(ADDRESS_ONE);
      expect(result.toLowerCase()).to.eq(ADDRESS_ONE);
    });

    it("returns the last item in a string of multiple addresses", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const first = await bytesLib.getLastAddress(mergeBytesString([ADDRESS_ONE, ADDRESS_TWO, ADDRESS_THREE]));
      expect(first.toLowerCase()).to.eq(ADDRESS_THREE);

      const second = await bytesLib.getLastAddress(mergeBytesString([ADDRESS_THREE, ADDRESS_ONE, ADDRESS_TWO]));
      expect(second.toLowerCase()).to.eq(ADDRESS_TWO);
    });

    it("returns the last item in a string of multiple addresses and additional data", async () => {
      const { bytesLib } = await loadFixture(setupFixture);
      const first = await bytesLib.getLastAddress(
        mergeBytesString([ADDRESS_ONE, "0x023f", ADDRESS_TWO, "0x023b", ADDRESS_THREE]),
      );
      expect(first.toLowerCase()).to.eq(ADDRESS_THREE);

      const second = await bytesLib.getLastAddress(
        mergeBytesString([ADDRESS_THREE, "0x023f", ADDRESS_ONE, "0x023b", ADDRESS_TWO]),
      );
      expect(second.toLowerCase()).to.eq(ADDRESS_TWO);
    });
  });
});
