import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { BigNumber, ContractFactory } from "ethers";
import { OracleManager, TestOracle } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { loadFixture } = waffle;

let owner: SignerWithAddress,
    outsider: SignerWithAddress,
    oracleManager: OracleManager;

const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const oracle1 = "0x06AC1e06aC1E06aC1e06aC1E06ac1E06AC1E06Ac";
const oracle2 = "0x16AC1E06aC1E06Ac1e06aC1E06ac1e06aC1e06aC";

describe("Oracle Manager", function () {
    async function fixture() {
        [owner, outsider] = await ethers.getSigners();

        const OracleManagerFactory: ContractFactory =
            await ethers.getContractFactory("OracleManager");
        oracleManager = (await OracleManagerFactory.deploy(weth)) as OracleManager;
    }

    beforeEach(async function () {
        await loadFixture(fixture);
    });

    describe("#constructor", function () {
        it("should fail if the supplied quote asset address is the zero address", async function () {
            const OracleManagerFactory: ContractFactory =
                await ethers.getContractFactory("OracleManager");
            await expect(OracleManagerFactory.deploy(ethers.constants.AddressZero)).to
                .be.reverted;
        });
    });

    describe("#setOracles", function () {
        it("should allow the owner to set the supported oracles", async function () {
            await expect(oracleManager.setOracles([oracle1])).to.not.be.reverted;
        });

        it("should allow the owner to set multiple supported oracles", async function () {
            await expect(oracleManager.setOracles([oracle1, oracle2])).to.not.be
                .reverted;
        });

        it("should emit SupportOracle when the supported oracles are set", async function () {
            expect(await oracleManager.setOracles([oracle1, oracle2]))
                .to.emit(oracleManager, "SetOracles")
                .withArgs(owner.address, [oracle1, oracle2]);
        });

        it("should not allow the owner to set an empty array as the supported oracles", async function () {
            await expect(oracleManager.setOracles([])).to.be.revertedWith(
                "OracleManager::too few oracles"
            );
        });

        it("should not allow a the owner to add more than the maximum number of oracles", async function () {
            await expect(
                oracleManager.setOracles([
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000002",
                    "0x0000000000000000000000000000000000000003",
                    "0x0000000000000000000000000000000000000004",
                    "0x0000000000000000000000000000000000000005",
                    "0x0000000000000000000000000000000000000006",
                    "0x0000000000000000000000000000000000000007",
                    "0x0000000000000000000000000000000000000008",
                    "0x0000000000000000000000000000000000000009",
                    "0x000000000000000000000000000000000000000a",
                    "0x000000000000000000000000000000000000000b",
                ])
            ).to.be.revertedWith("OracleManager::too many oracles");
        });

        it("should not allow the owner to add a zero address as a supported oracle", async function () {
            await expect(
                oracleManager.setOracles([ethers.constants.AddressZero])
            ).to.be.revertedWith("OracleManager::zero address");
        });

        it("should not allow a non-owner to set the supported oracles", async function () {
            await expect(
                oracleManager.connect(outsider).setOracles([oracle1])
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should overwrite previous oracles", async function () {
            await oracleManager.setOracles([
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000002",
                "0x0000000000000000000000000000000000000003",
                "0x0000000000000000000000000000000000000004",
                "0x0000000000000000000000000000000000000005",
            ]);

            const newOracles = [
                "0x0000000000000000000000000000000000000007",
                "0x0000000000000000000000000000000000000008",
                "0x0000000000000000000000000000000000000009",
            ];
            await oracleManager.setOracles(newOracles);

            expect(await oracleManager.oracles(0)).to.equal(newOracles[0]);
            expect(await oracleManager.oracles(1)).to.equal(newOracles[1]);
            expect(await oracleManager.oracles(2)).to.equal(newOracles[2]);
        });
    });

    describe("#getOracles", function () {
        it("should return an empty array if there are no supported oracles", async function () {
            expect(await oracleManager.getOracles()).to.be.empty;
        });

        it("should return the supported oracles", async function () {
            const newOracles = [
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000002",
                "0x0000000000000000000000000000000000000003",
            ];
            await oracleManager.setOracles(newOracles);

            const returnedOracles = await oracleManager.getOracles();
            expect(returnedOracles[0]).to.equal(newOracles[0]);
            expect(returnedOracles[1]).to.equal(newOracles[1]);
            expect(returnedOracles[2]).to.equal(newOracles[2]);
        });
    });

    describe("#getPrice", function () {
        it("should return the price of the quote asset as 1e18", async function () {
            const result = await oracleManager.getPrice(weth);
            expect(result).to.be.equal(ethers.utils.parseEther("1"));
        });

        it("should return the price given by the first oracle that supports the asset", async function () {
            const token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
            const price1 = ethers.utils.parseEther("5");
            const price2 = ethers.utils.parseEther("6");
            const TestOracleFactory: ContractFactory =
                await ethers.getContractFactory("TestOracle");

            const testOracle1 = (await TestOracleFactory.deploy(
                [token],
                [price1]
            )) as TestOracle;

            const testOracle2 = (await TestOracleFactory.deploy(
                [token],
                [price2]
            )) as TestOracle;

            await oracleManager.setOracles([
                testOracle1.address,
                testOracle2.address,
            ]);

            const result = await oracleManager.getPrice(token);
            expect(result).to.be.equal(price1);
        });

        it("should revert if none of the oracles support the asset", async function () {
            const token1 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
            const token2 = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
            const price1 = ethers.utils.parseEther("5");
            const price2 = ethers.utils.parseEther("6");
            const TestOracleFactory: ContractFactory =
                await ethers.getContractFactory("TestOracle");

            const testOracle1 = (await TestOracleFactory.deploy(
                [token1],
                [price1]
            )) as TestOracle;

            const testOracle2 = (await TestOracleFactory.deploy(
                [token1],
                [price2]
            )) as TestOracle;

            await oracleManager.setOracles([
                testOracle1.address,
                testOracle2.address,
            ]);

            await expect(oracleManager.getPrice(token2)).to.be.revertedWith(
                "OracleManager::not supported"
            );
        });

        it("should revert if an oracle supports the asset but it fails to get price", async function () {
            const token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

            const price = ethers.utils.parseEther("5");
            const TestOracleFactory: ContractFactory =
                await ethers.getContractFactory("TestOracle");
            const testOracle = (await TestOracleFactory.deploy(
                [token],
                [price]
            )) as TestOracle;

            await oracleManager.setOracles([testOracle.address]);
            await testOracle.setForceFail(token);

            await expect(oracleManager.getPrice(token)).to.be.revertedWith(
                "OracleManager::not supported"
            );
        });
    });
});