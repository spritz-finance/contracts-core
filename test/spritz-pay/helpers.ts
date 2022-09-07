import axios from "axios";
import { FixedNumber } from "ethers";

import { ZERO_ADDRESS } from "../helpers/constants";

const zeroXResponse1 = require("./mocks/zeroxQuoteResponse1.json");
const zeroXResponse2 = require("./mocks/zeroxQuoteResponse2.json");

export const getPayWithSwapArgs = async (buyToken: string, amount: number, sellToken: string, reference: string) => {
  // const { data } = await axios.get(`https://polygon.api.0x.org/swap/v1/quote`, {
  //   params: {
  //     buyToken,
  //     buyAmount: amount,
  //     sellToken,
  //   },
  // });
  // console.log(JSON.stringify(data, undefined, 2));
  const quote = sellToken == ZERO_ADDRESS ? zeroXResponse2 : zeroXResponse1;

  const { buyAmount, sellAmount, price, guaranteedPrice } = quote;

  const adjusted = FixedNumber.from(sellAmount)
    .mulUnsafe(FixedNumber.from(guaranteedPrice))
    .divUnsafe(FixedNumber.from(price));
  // .mulUnsafe(FixedNumber.from("1.001"));

  quote.adjustedSellAmount = adjusted.toString().split(".")[0];

  console.log({
    buyAmount,
    sellAmount,
    price,
    guaranteedPrice,
    adjustedSellAmount: quote.adjustedSellAmount,
  });

  return [
    sellToken,
    quote.adjustedSellAmount,
    buyToken,
    quote.buyAmount,
    quote.data,
    reference,
    {
      value: quote.value,
      gasPrice: quote.gasPrice,
    },
  ];
};
