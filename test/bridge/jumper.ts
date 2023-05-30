import axios from "axios";

interface BridgeQuoteParams {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAddress: string;

  toAddress: string;
  fromAmount: string;
}

export async function getBridgeQuote(params: BridgeQuoteParams) {
  console.log("getBridgeQuote", params);
  const { data } = await axios.get<{
    transactionRequest: {
      data: string;
      to: string;
      value: string;
      from: string;
      chainId: number;
      gasPrice: string;
      gasLimit: string;
    };
  }>("https://li.quest/v1/quote", {
    params: {
      ...params,
      order: "SAFEST",
      denyBridges: "multichain",
    },
  });

  return data.transactionRequest;
}
