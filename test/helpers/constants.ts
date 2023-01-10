import { ethers } from "ethers";

export const FUNDS = ethers.utils.parseEther("1000");
export const FUNDING_PORTION = ethers.utils.parseEther("30");
export const ONE_ETHER = ethers.utils.parseEther("1");
export const TEN_ETHER = ethers.utils.parseEther("10");
export const ONE_MIN = 60;
export const ONE_HOUR = ONE_MIN * 60;
export const ONE_DAY = ONE_HOUR * 24;
export const originationFee = ethers.utils.parseUnits("0.05", 18);
export const coupon = ethers.utils.parseUnits("0.03", 18);
export const ltv = ethers.utils.parseUnits("1.3", 18);
export const minSupply = ethers.utils.parseEther("2");
export const supplyCap = ethers.utils.parseEther("1000");
export const testAssetsPrices = [
  ONE_ETHER,
  ethers.utils.parseUnits("1.2", 18),
  ONE_ETHER,
  ONE_ETHER,
  ONE_ETHER,
  ONE_ETHER,
];
export const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
