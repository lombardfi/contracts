import hre from "hardhat";
import fs from "fs";

export async function verify(): Promise<void> {
  const contracts = JSON.parse(fs.readFileSync(`./contracts.json`, "utf-8"));

  if (contracts.network != hre.network.name) {
    throw new Error(
      "Contracts are not deployed on the same network, that you are trying to verify!"
    );
  }

  //verify Router contract
  try {
    await hre.run("verify:verify", {
      address: contracts.router,
      constructorArguments: [],
    });
  } catch (error: any) {
    logError("Router", error.message);
  }

  //verify PoolFactory contract
  try {
    await hre.run("verify:verify", {
      address: contracts.poolFactory,
      constructorArguments: [],
    });
  } catch (error: any) {
    logError("PoolFactory", error.message);
  }

  //verify OracleManager contract
  try {
    await hre.run("verify:verify", {
      address: contracts.oracleManager,
      constructorArguments: [],
    });
  } catch (error: any) {
    logError("OracleManager", error.message);
  }

  //verify PermissionManagewr contract
  try {
    await hre.run("verify:verify", {
      address: contracts.permissionManager,
      constructorArguments: [],
    });
  } catch (error: any) {
    logError("PermissionManagewr", error.message);
  }
}

function logError(contractName: string, msg: string) {
  console.log(
    `\x1b[31mError while trying to verify contract: ${contractName}!`
  );
  console.log(`Error message: ${msg}`);
  resetConsoleColor();
}

function resetConsoleColor() {
  console.log("\x1b[0m");
}
