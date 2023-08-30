import { ethers } from "ethers";

export const formatPaymentReference = (paymentId: string) => {
  return ethers.utils.hexZeroPad(ethers.utils.arrayify(`0x${paymentId}`), 32);
};
