import hre, { ethers } from "hardhat";
import fs from "fs";
import dotenv from "dotenv";
import { CustomERC20 } from "../types";
import { configs } from "./config/deploymentConfig";

dotenv.config();

export async function distributeTestTokens() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments-${hre.network.name}.json`, "utf-8"));

  const network = hre.network.name;
  const config = configs[network as keyof typeof configs];

  if (config === undefined) {
    throw new Error(`network must be any of ${Object.keys(configs)}.`);
  }

  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Using account:", deployer.address);
  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const recipients = [
    "0xf523aFEb3d6A1c45A109e90294Cec0dA2AF74a25",
    "0xBa6d45dA94F698FF7aCCe190731b309591CC209d",
    "0x380Fa2d97357e2bEf991c63CEC20a280b8CA6EE3",
    "0x0000000f653AdDe054F28714804B7Ca91efaE11d",
    "0x1111111301FF10E69ADf54C2c2bB45dD07037218"
  ];

  const deployedTokens = Object.values(deployments.tokens);
  for(let i = 0; i < deployedTokens.length; i++)  {
    const { symbol, decimals, address } = (deployedTokens as any)[i];
    const amountToMint = ethers.utils.parseUnits("1000000000", decimals).mul(recipients.length);

    const CustomERC20Factory = await ethers.getContractFactory("CustomERC20");
    const token = CustomERC20Factory.attach(
      address
    ) as CustomERC20;

    const mintTx = await token.mint(amountToMint);

    await mintTx.wait();
    console.log(`Minted ${symbol} to deployer.`);

    for(let j = 0; j < recipients.length; j++) {
      const recipient = recipients[j];

      if(recipient != deployer.address) {
        const transferTx = await token.transfer(recipient, amountToMint.div(recipients.length));

        await transferTx.wait();
        console.log(`Distributed ${symbol} to ${recipient}`);
      }
    }
  }
  console.log("Done!");
}
