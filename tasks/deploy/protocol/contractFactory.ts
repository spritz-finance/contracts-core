/* eslint-disable @typescript-eslint/no-explicit-any */
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { verifyContract } from "../../utils/verify";

// optimizer: 100_000 runs
// solidity: version 0.8.21
// evm_version: paris
// deployed to: 0x0a9190fb699b6ec18fea4dc2791548aa24e12f36
const FACTORY_INIT_CODE =
  "0x608060405234801561001057600080fd5b50610301806100206000396000f3fe6080604052600436106100295760003560e01c8063ca9ffe941461002e578063cdcb760a14610077575b600080fd5b34801561003a57600080fd5b5061004e610049366004610268565b61008c565b60405173ffffffffffffffffffffffffffffffffffffffff909116815260200160405180910390f35b61008a610085366004610268565b6100ce565b005b6000806100b08585856040516100a39291906102e4565b6040518091039020610155565b915050803b80156100c55760009150506100c7565b505b9392505050565b82606081901c331461010c576040517f81e69d9b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61014e60008585858080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525061016292505050565b5050505050565b60006100c783833061023e565b6000834710156101ab576040517fe4bbecac0000000000000000000000000000000000000000000000000000000081524760048201526024810185905260440160405180910390fd5b81516000036101e6576040517f4ca249dc00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8282516020840186f5905073ffffffffffffffffffffffffffffffffffffffff81166100c7576040517f741752c200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000604051836040820152846020820152828152600b8101905060ff815360559020949350505050565b60008060006040848603121561027d57600080fd5b83359250602084013567ffffffffffffffff8082111561029c57600080fd5b818601915086601f8301126102b057600080fd5b8135818111156102bf57600080fd5b8760208285010111156102d157600080fd5b6020830194508093505050509250925092565b818382376000910190815291905056fea164736f6c6343000815000a";

task("deploy:contract-factory").setAction(async function (_taskArguments: TaskArguments, hre) {
  const signer = (await hre.ethers.getSigners())[0];

  // Deploying contract
  const tx = await signer.sendTransaction({
    data: FACTORY_INIT_CODE,
  });

  console.log("Transaction Sent: ", tx.hash);

  const receipt = await tx.wait(6);

  const contractAddress = receipt.contractAddress;

  console.log(`Deployed to ${contractAddress} with tx: ${receipt.transactionHash}`);

  await hre.run(`verify:verify`, {
    address: contractAddress,
    contract: "contracts/protocol/factories/SpritzContractFactory.sol:SpritzContractFactory",
    constructorArguments: [],
  });
});

task("verify:contract-factory").setAction(async function (_taskArguments: TaskArguments, hre) {
  await verifyContract("0x0a9190fb699b6ec18fea4dc2791548aa24e12f36", hre, [], {
    contract: "contracts/protocol/factories/SpritzContractFactory.sol:SpritzContractFactory",
  });
});
