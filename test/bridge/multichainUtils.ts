import axios from "axios";

export async function getBridgeData(token: string, chainId: string, targetChainId: string) {
  const { data } = await axios.get<Record<string, any>>(`https://bridgeapi.multichain.org/v4/tokenlistv4/${chainId}`);

  const src = Object.values(data).find(obj => obj.address !== token.toLowerCase());
  const destChainObj = src?.destChains?.[targetChainId];

  if (!destChainObj) throw new Error("No quote");

  //use first one? e.g. bsc -> polygon has 3
  const dest = Object.values(destChainObj)[0] as any;

  if (!dest) throw new Error("No quote");

  const isUnderlying = !!dest.routerABI.match(/anySwapOutUnderlying/);

  return {
    isUnderlying,
    swapToken: dest.fromanytoken.address,
    dest,
  };
}
