import {
  ADMIN_POLYGON,
  SMARTPAY_PRODUCTION_POLYGON_ADDRESS,
  SMARTPAY_STAGING_POLYGON_ADDRESS,
  SMART_PAY_BOT_ADDRESS_PRODUCTION,
  SMART_PAY_BOT_ADDRESS_STAGING,
  SPRITZPAY_POLYGON_ADDRESS,
  SPRITZPAY_STAGING_POLYGON_ADDRESS,
} from "../constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const smartPayContractConfig: Record<string, Record<string, { proxy: string; args: any[] }>> = {
  staging: {
    "polygon-mainnet": {
      proxy: SMARTPAY_STAGING_POLYGON_ADDRESS,
      args: [ADMIN_POLYGON, SPRITZPAY_STAGING_POLYGON_ADDRESS, SMART_PAY_BOT_ADDRESS_STAGING],
    },
  },
  production: {
    "polygon-mainnet": {
      proxy: SMARTPAY_PRODUCTION_POLYGON_ADDRESS,
      args: [ADMIN_POLYGON, SPRITZPAY_POLYGON_ADDRESS, SMART_PAY_BOT_ADDRESS_PRODUCTION],
    },
  },
};

export const getSmartPayContractConfig = (env: string, network: string) =>
  smartPayContractConfig[env as string][network as string];
