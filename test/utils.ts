import { ethers } from "ethers";

export const formatPaymentReference = (paymentId: string) => {
  return ethers.utils.hexZeroPad(ethers.utils.arrayify(`0x${paymentId}`), 32);
};

const encoder = new ethers.utils.AbiCoder();

export type Operations = [string[], number[], string[]];
const hexStringBytes = (hexString: string) => hexString.slice(2);

const firstBytes = (hexString: string, bytes: number) => {
  return hexString.slice(0, bytes * 2 + 2);
};

const getSelector = (signature: string) => {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
  return firstBytes(hash, 4);
};

export const contructFunctionCalldata = ({
  functionName,
  argTypes,
  values,
}: {
  functionName: string;
  argTypes: string[];
  values: (string | number)[];
}) => {
  const selector = getSelector(`${functionName}(${argTypes.join(",")})`);
  const data = encoder.encode(argTypes, values);
  return `${selector}${hexStringBytes(data)}`;
};
