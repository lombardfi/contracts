import { task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import * as dotenv from "dotenv";
import "./scripts/config/deploymentConfig";

dotenv.config();

const lazyImport = async (module: any) => {
  return await import(module);
};

task(
  "deployCoreContracts", 
  "Deploy main contracts: Router, PoolFactory, OracleManager"
).setAction(
  async () => {
    const { deployCoreContracts } = await lazyImport("./scripts/deployCoreContracts");
    await deployCoreContracts();
  }
);

task(
  "deployTestOracle", 
  "Deploy TestOracle and set prices"
).setAction(
  async () => {
    const { deployTestOracle } = await lazyImport("./scripts/deployTestOracle");
    await deployTestOracle();
  }
);

task(
  "verifyDeployments",
  "Verify already deployed contracts"
).setAction(async () => {
  const { verify } = await lazyImport("./scripts/verify");
  await verify();
});

task(
  "deployTestPools", 
  "Deploy test pools"
).setAction(async () => {
  const { deployTestPools } = await lazyImport("./scripts/deployTestPools");
  await deployTestPools();
});

task(
  "distributeTestTokens", 
  "Distribute test tokens"
).setAction(async () => {
  const { distributeTestTokens } = await lazyImport("./scripts/distributeTestTokens");
  await distributeTestTokens();
});

const config: any = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: false,
            },
          },
        },
      },
    ],
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    }
  },
  typechain: {
    outDir: "types",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
