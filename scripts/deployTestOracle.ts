import hre, { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import { OracleManager, TestOracle } from "../types";
import { configs } from "./config/deploymentConfig";

dotenv.config();

export async function deployTestOracle() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments-${hre.network.name}.json`, "utf-8"));

  const network = hre.network.name;
  const config = configs[network as keyof typeof configs];

  const OracleManagerFactory = await ethers.getContractFactory("OracleManager");
  const OracleManager = OracleManagerFactory.attach(
    deployments.oracleManager
  ) as OracleManager;

  if (config === undefined) {
    throw new Error(`network must be any of ${Object.keys(configs)}.`);
  }

  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const addressesAndPrices = Object.values(config.tokens)
    .map(({ symbol, price }) => ({
      address: (Object.values(deployments.tokens).find((d: any) => d.symbol === symbol) as any).address,
      price
    }));

  const TestOracleFactory: ContractFactory = await ethers.getContractFactory(
    "TestOracle"
  );
  const testOracle = (await TestOracleFactory.deploy(
    addressesAndPrices.map(({ address }) => address),
    addressesAndPrices.map(({ price }) => price),
  )) as TestOracle;

  console.log(
    `Deploying TestOracle at address: ${testOracle.address} please wait...\n`
  );

  await testOracle.deployed();
  
  const oraclesToSet = [testOracle.address];
  const setOraclesTx = await OracleManager.setOracles(oraclesToSet);
  await setOraclesTx.wait();

  console.log(`Oracles have been set to ${oraclesToSet}\n`);

  fs.writeFileSync(
    `./deployments-${hre.network.name}.json`,
    JSON.stringify(
      {
        ...deployments,
        testOracle: testOracle.address,
      },
      null,
      2
    )
  );

  console.log("Done!");
}
