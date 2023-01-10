import { ethers, network } from "hardhat";

export async function getBlockTimestamp() {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}

export async function increaseTime(overtime: number) {
  await ethers.provider.send("evm_increaseTime", [overtime]);
  await network.provider.send("evm_mine");
}

export async function setNextBlockTimestamp(timestamp: number) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
}
