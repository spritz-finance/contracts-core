import { ethers, network } from "hardhat";
import { Fetcher, JSBI, Pair, Percent, Route, Token, TokenAmount, Trade, TradeType } from "quickswap-sdk";

export const USDC = new Token(137, "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6, "USDC", "USDC");
export const USDT = new Token(137, "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6, "USDT", "Tether USD");
export const WMATIC = new Token(137, "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", 18, "WMATIC", "Wrapped MATIC");
export const WETH = new Token(137, "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 18, "WETH", "Wrapped ETHER");
export const QUICK = new Token(137, "0x831753DD7087CaC61aB5644b308642cc1c33Dc13", 18, "QUICK", "Quickswap");
export const DAI = new Token(137, "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", 18, "DAI", "Dai Stablecoin");
export const WBTC = new Token(137, "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", 8, "WBTC", "Wrapped BTC");

export const getERC20Contracts = (tokenAddresses: string[]) => {
  return Promise.all(tokenAddresses.map(address => ethers.getContractAt("IERC20", address)));
};

export const getUniswapFactory = (address: string) => {
  return ethers.getContractAt("IUniswapV2Factory", address);
};

export const getUniswapPair = (pairAddress: string) => {
  return ethers.getContractAt("IUniswapV2Pair", pairAddress);
};

export const getUniswapRouter = (routerAddress: string) => {
  return ethers.getContractAt("IUniswapV2Router02", routerAddress);
};

export const getPairData = async (tokenA: Token, tokenB: Token) => {
  const data = await Fetcher.fetchPairData(tokenA, tokenB, ethers.provider);
  return data;
};

export const getStablecoinPairsForToken = async (tokenA: Token) => {
  return Promise.all([USDC, USDT, DAI].map(tokenB => getPairData(tokenA, tokenB)));
};

export const getTrades = (pairs: Pair[], tokenA: Token, fiatAmount: number) => {
  return pairs.map(pair => {
    return new Trade(
      new Route([pair], tokenA),
      new TokenAmount(
        pair.token1,
        JSBI.multiply(JSBI.BigInt(fiatAmount), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(pair.token1.decimals))),
      ),
      TradeType.EXACT_OUTPUT,
    );
  });
};
