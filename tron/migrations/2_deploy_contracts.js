var SpritzTronReceiver = artifacts.require("./SpritzTronReceiver.sol");

const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDC_TRON = "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8";

const USDT_USDC_POOL = [
  "TE7SB1v9vRbYRe5aJMWQWp9yfE2k9hnn3s", //curve pool
  2, //usdt index
  0, //usdc index
];

module.exports = function (deployer) {
  const args = [
    USDT_TRON, //usdt token address
    USDC_TRON, //usdc token address
    ...USDT_USDC_POOL,
    process.env.TRON_USDC_RECEIVER, //receiving address
  ];

  deployer.deploy(SpritzTronReceiver, ...args);
};
