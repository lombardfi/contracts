import { ethers } from "ethers";

export const configs = {
  sepolia: {
    wethAddress: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    treasury: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    tokens: [
      {
        name: "Dai Stablecoin",
        symbol: "DAI",
        decimals: 18,
        price: ethers.utils.parseEther("0.001")
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        price: ethers.utils.parseEther("0.001")
      },
      {
        name: "Tether USDT",
        symbol: "USDT",
        decimals: 6,
        price: ethers.utils.parseEther("0.001")
      },
      {
        name: "Wrapped Ether",
        symbol: "WETH",
        decimals: 18,
        price: ethers.utils.parseEther("1")
      },
      {
        name: "Wrapped BTC",
        symbol: "WBTC",
        decimals: 8,
        price: ethers.utils.parseEther("20")
      },
      {
        name: "FTX Token",
        symbol: "FTT",
        decimals: 18,
        price: ethers.utils.parseEther("0.05")
      },
      {
        name: "Maker",
        symbol: "MKR",
        decimals: 18,
        price: ethers.utils.parseEther("0.5")
      },
      {
        name: "Aave Token",
        symbol: "AAVE",
        decimals: 18,
        price: ethers.utils.parseEther("2")
      },
      {
        name: "ApeCoin",
        symbol: "APE",
        decimals: 18,
        price: ethers.utils.parseEther("5")
      }
    ],
    pools: ({ tokens }: any) => [
      {
        lentAsset: tokens.USDC.address,
        collateralAssets: [tokens.MKR.address, tokens.AAVE.address],
        coupon: ethers.utils.parseEther("0.0375"),
        ltv: ethers.utils.parseEther("10"),
        activeAt: Math.floor(new Date('2022-11-05').getTime() / 1000),
        maturesAt: Math.floor(new Date('2023-02-05').getTime() / 1000),
        minSupply: ethers.utils.parseUnits("1000000", tokens.USDC.decimals),
        maxSupply: ethers.utils.parseUnits("20000000", tokens.USDC.decimals),
        whitelistedLender: ethers.constants.AddressZero,
      },
      {
        lentAsset: tokens.WBTC.address,
        collateralAssets: [tokens.USDC.address, tokens.DAI.address, tokens.USDT.address],
        coupon: ethers.utils.parseEther("0.02"),
        ltv: ethers.utils.parseEther("2"),
        activeAt: Math.floor(new Date('2022-11-15').getTime() / 1000),
        maturesAt: Math.floor(new Date('2023-04-15').getTime() / 1000),
        minSupply: ethers.utils.parseUnits("50", tokens.WBTC.decimals),
        maxSupply: ethers.utils.parseUnits("1000", tokens.WBTC.decimals),
        whitelistedLender: ethers.constants.AddressZero,
      },
      {
        lentAsset: tokens.FTT.address,
        collateralAssets: [tokens.USDT.address],
        coupon: ethers.utils.parseEther("0.05"),
        ltv: ethers.utils.parseEther("5"),
        activeAt: Math.floor(new Date('2022-12-01').getTime() / 1000),
        maturesAt: Math.floor(new Date('2023-05-01').getTime() / 1000),
        minSupply: ethers.utils.parseUnits("5000000", tokens.USDT.decimals),
        maxSupply: ethers.utils.parseUnits("50000000", tokens.USDT.decimals),
        whitelistedLender: ethers.constants.AddressZero,
      },
    ],
  },
};
