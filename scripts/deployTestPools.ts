import hre, { ethers } from "hardhat";
import fs from "fs";
import dotenv from "dotenv";
import { CustomERC20, PoolFactory } from "../types";
import { configs } from "./config/deploymentConfig";

const { BigNumber } = ethers;
dotenv.config();

export async function deployTestPools() {
  let deployments = JSON.parse(fs.readFileSync(`./deployments-${hre.network.name}.json`, "utf-8"));

  const network = hre.network.name;
  const config = configs[network as keyof typeof configs];

  if (config === undefined) {
    throw new Error(`network must be any of ${Object.keys(configs)}.`);
  }

  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const deployedTokens = {};
  for(let i = 0; i < config.tokens.length; i++)  {
    const { name, symbol, decimals } = config.tokens[i];

    const alreadyDeployedToken = deployments.tokens?.[symbol];
    if(alreadyDeployedToken) {
      console.log(`Token ${
        alreadyDeployedToken.symbol
      } (${
        alreadyDeployedToken.name
      }) with ${
        alreadyDeployedToken.decimals
      } decimals already deployed at address ${
        alreadyDeployedToken.address
      }`);
      continue;
    }

    const CustomERC20Factory = await ethers.getContractFactory("CustomERC20");

    const token = (await CustomERC20Factory.deploy(name, symbol, decimals)) as CustomERC20;

    console.log(
      `Deploying ${symbol} (${name}) with ${decimals} decimals at address ${token.address} please wait...\n`
    );

    await token.deployed();

    (deployedTokens as any)[symbol] = {
      name,
      symbol,
      decimals,
      address: token.address
    };
  }


  fs.writeFileSync(
    `./deployments-${hre.network.name}.json`,
    JSON.stringify(
      {
        ...deployments,
        tokens: {
          ...deployments.tokens,
          ...deployedTokens,
        }
      },
      null,
      2
    )
  );

  deployments = JSON.parse(fs.readFileSync(`./deployments-${hre.network.name}.json`, "utf-8"));
  const PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
  const poolFactory = PoolFactoryFactory.attach(
    deployments.poolFactory
  ) as PoolFactory;

  const poolConfigs = config.pools({tokens: deployments.tokens});
  for (let i = 0; i < poolConfigs.length; i++) {
    const {
      lentAsset,
      collateralAssets,
      coupon,
      ltv,
      activeAt,
      maturesAt,
      minSupply,
      maxSupply,
      whitelistedLender
    } = poolConfigs[i];

    const CustomERC20Factory = await ethers.getContractFactory("CustomERC20");
    const lentAssetTest = CustomERC20Factory.attach(lentAsset) as CustomERC20;

    const allowance = await lentAssetTest.allowance(
      deployer.address,
      poolFactory.address
    );

    const balance = await lentAssetTest.balanceOf(deployer.address);

    const upfrontSize = BigNumber.from(maxSupply)
      .mul(coupon)
      .div(ethers.utils.parseEther("1"));
    if (balance.lt(upfrontSize)) {
      console.log(`Minting ${upfrontSize} lent asset...\n`);
      const txMint = await lentAssetTest.connect(deployer).mint(upfrontSize);
      await txMint.wait();
    }

    if (allowance.lt(upfrontSize)) {
      console.log(
        `Approving pool factory to spend ${upfrontSize} lent asset...\n`
      );
      const txApprove = await lentAssetTest
        .connect(deployer)
        .approve(deployments.poolFactory, upfrontSize);
      await txApprove.wait();
    }

    console.log("Deploying new pool...\n");

    const txDeployPool = await poolFactory.createPool(
      lentAsset,
      collateralAssets,
      coupon,
      ltv,
      activeAt,
      maturesAt,
      minSupply,
      maxSupply,
      whitelistedLender
    );
    await txDeployPool.wait();
  }

  const allPools = await poolFactory.getAllPools();

  fs.writeFileSync(
    `./deployments-${hre.network.name}.json`,
    JSON.stringify(
      {
        ...deployments,
        pools: allPools
      },
      null,
      2
    )
  );

  console.log("Done!");
}
