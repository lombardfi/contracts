import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import { OracleManager, PoolFactory, Router } from "../types";
import { configs } from "./config/deploymentConfig";

dotenv.config();

export async function deployCoreContracts() {
  const network = hre.network.name;
  const config = configs[network as keyof typeof configs];

  if (config === undefined) {
    throw new Error(`network must be any of ${Object.keys(configs)}.`);
  }
  const { wethAddress, treasury } = config;

  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const RouterFactory: ContractFactory = await ethers.getContractFactory(
    "Router"
  );
  const router = (await RouterFactory.deploy()) as Router;

  console.log(
    `Deploying Router at address: ${router.address} please wait...\n`
  );

  await router.deployed();

  const PoolFactoryFactory: ContractFactory = await ethers.getContractFactory(
    "PoolFactory"
  );
  const poolFactory = (await PoolFactoryFactory.deploy(
    router.address
  )) as PoolFactory;

  console.log(
    `Deploying PoolFactory at address: ${poolFactory.address} please wait...\n`
  );

  await poolFactory.deployed();

  const OracleManagerFactory: ContractFactory = await ethers.getContractFactory(
    "OracleManager"
  );
  const oracleManager = (await OracleManagerFactory.deploy(
    wethAddress
  )) as OracleManager;

  console.log(
    `Deploying OracleManager at address: ${oracleManager.address} please wait...\n`
  );

  await oracleManager.deployed();

  const setFactoryTx = await router.setFactory(poolFactory.address);
  await setFactoryTx.wait();

  console.log(
    `PoolFactory contract has been set at address ${poolFactory.address}\n`
  );

  const setOracleManagerTx = await router.setOracleManager(
    oracleManager.address
  );
  await setOracleManagerTx.wait();

  console.log(
    `OracleManager contract has been set at address ${oracleManager.address}\n`
  );

  expect(treasury).to.not.be.eq(ethers.constants.AddressZero);

  const setTreasuryTx = await router.setTreasury(treasury);
  await setTreasuryTx.wait();

  console.log(`Treasury address has been set at address ${treasury}\n`);

  fs.writeFileSync(
    `./deployments-${hre.network.name}.json`,
    JSON.stringify(
      {
        network: hre.network.name,
        router: router.address,
        poolFactory: poolFactory.address,
        oracleManager: oracleManager.address,
        treasury
      },
      null,
      2
    )
  );

  console.log("Done!");
}
