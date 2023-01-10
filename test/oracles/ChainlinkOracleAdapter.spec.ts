import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ContractFactory } from "ethers";
import * as dotenv from "dotenv";
import { ChainlinkOracleAdapter } from "../../types";
import { getBlockTimestamp } from "../helpers/helpers";

const { deployMockContract, loadFixture } = waffle;

dotenv.config();

let chainlinkOracleAdapter: ChainlinkOracleAdapter,
    ChainlinkOracleAdapterFactory: ContractFactory,
    mockFeedRegistry: any;

const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const feed = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
const token = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
const eth = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const wbtc = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"


describe("ChainlinkOracleAdapter", function () {
    async function fixture() {
        const [owner] = await ethers.getSigners();

        mockFeedRegistry = await deployMockContract(owner, [
            "function decimals(address base, address quote) external view returns (uint8 decimals)",
            "function getFeed(address base, address quote) external view returns (address aggregator)",
            "function latestRoundData(address base, address quote) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
        ]);

        ChainlinkOracleAdapterFactory = await ethers.getContractFactory(
            "ChainlinkOracleAdapter"
        );
        chainlinkOracleAdapter = (await ChainlinkOracleAdapterFactory.deploy(
            mockFeedRegistry.address,
            weth,
            wbtc
        )) as ChainlinkOracleAdapter;

        await chainlinkOracleAdapter.deployed();
    }

    beforeEach(async function () {
        await loadFixture(fixture);
    });

    context("#constructor", function () {
        it("should revert if the feed registry is the zero address", async function () {
            await expect(
                ChainlinkOracleAdapterFactory.deploy(ethers.constants.AddressZero, weth, wbtc)
            ).to.be.revertedWith("ChainlinkOracle::zero address");
        });
    });

    context("#setAssetStatus", function () {
        const fakeAddress = "0x0101010101010101010101010101010101010101";

        it("should set base assets out of service", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const baseAsset = fakeAddress;
            const baseAssetState = true;

            await chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState);

            const isDisabled = await chainlinkOracleAdapter.disabledAssets(
                fakeAddress
            );

            expect(isDisabled).to.be.true;
        });

        it("should set base assets out of service and then remove the ban", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const baseAsset: string = fakeAddress;
            const baseAssetState = true;

            await chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState);

            const isDisabled = await chainlinkOracleAdapter.disabledAssets(
                fakeAddress
            );

            expect(isDisabled).to.be.true;

            const baseAssetState2 = false;

            await chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState2);

            const isDisabled2 = await chainlinkOracleAdapter.disabledAssets(
                fakeAddress
            );

            expect(isDisabled2).to.be.false;
        });

        it("should revert if baseAsset address is the zero address", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const baseAsset: string = ethers.constants.AddressZero;
            const baseAssetState = true;

            await expect(
                chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState)
            ).to.be.revertedWith("ChainlinkOracle::zero address");
        });

        it("should revert if baseAsset address is the WETH", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const baseAsset: string = weth;
            const baseAssetState = true;

            await expect(
                chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState)
            ).to.be.revertedWith("ChainlinkOracle::not supported");
        });

        it("should revert if baseAsset address is the WETH", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const baseAsset: string = eth;
            const baseAssetState = true;

            await expect(
                chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState)
            ).to.be.revertedWith("ChainlinkOracle::not supported");
        });

        it("should revert if baseAsset address is the WETH", async function () {
            await mockFeedRegistry.mock.getFeed.returns(ethers.constants.AddressZero);

            const baseAsset = fakeAddress;
            const baseAssetState = true;

            await expect(
                chainlinkOracleAdapter.setAssetStatus(baseAsset, baseAssetState)
            ).to.be.revertedWith("ChainlinkOracle::not supported");
        });
    });

    context("#supportsAsset", function () {
        it("should return true if the feed registry returns a non-zero aggregator address and base is the weth address", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                token,
                weth
            );

            expect(supportsAsset).to.be.true;
        });

        it("should return true if the feed registry returns a non-zero aggregator address for base wbtc and quote is the weth address", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                wbtc,
                weth
            );

            expect(supportsAsset).to.be.true;
        });

        it("should return true is the feed registry returns a non-zero aggregator address and quote is 0xEee", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                token,
                eth
            );

            expect(supportsAsset).to.be.true;
        });

        it("should return true is the feed registry returns a non-zero aggregator address for base wbtc and quote is 0xEee", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                wbtc,
                eth
            );

            expect(supportsAsset).to.be.true;
        });


        it("should return false is if the base is not weth or eth", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                eth,
                token
            );

            expect(supportsAsset).to.be.false;
        });

        it("should return true if the feed registry returns a non-zero aggregator address and quote is 0xEee", async function () {
            await mockFeedRegistry.mock.getFeed.returns(feed);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                token,
                eth
            );

            expect(supportsAsset).to.be.true;
        });

        it("should return false if the feed registry returns a zero aggregator address", async function () {
            await mockFeedRegistry.mock.getFeed.returns(ethers.constants.AddressZero);

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                token,
                weth
            );

            expect(supportsAsset).to.be.false;
        });

        it("should return false is the feed registry throws", async function () {
            await mockFeedRegistry.mock.getFeed.reverts();

            const supportsAsset = await chainlinkOracleAdapter.supportsAsset(
                token,
                weth
            );

            expect(supportsAsset).to.be.false;
        });
    });

    context("#getPrice", function () {
        it("should return the latest price given by the feed registry", async function () {
            const result = await chainlinkOracleAdapter.getPrice(token, weth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });

        it("should return the latest price given by the feed registry for base wbtc", async function () {
            const result = await chainlinkOracleAdapter.getPrice(wbtc, weth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });

        it("should return true and the latest price given by the feed registry with quote weth", async function () {
            const blockTimestamp = await getBlockTimestamp();

            await mockFeedRegistry.mock.latestRoundData.returns(
                0,
                42,
                0,
                blockTimestamp,
                0
            );
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, weth);

            expect(result[0]).to.be.true;
            expect(result[1]).to.equal(42);
        });

        it("should return true and the latest price given by the feed registry with base 0xEee", async function () {
            const blockTimestamp = await getBlockTimestamp();

            await mockFeedRegistry.mock.latestRoundData.returns(
                0,
                42,
                0,
                blockTimestamp,
                0
            );
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, eth);

            expect(result[0]).to.be.true;
            expect(result[1]).to.equal(42);
        });

        it("should return true and the latest price given by the feed registryfore base wbtc with quote 0xEee", async function () {
            const blockTimestamp = await getBlockTimestamp();

            await mockFeedRegistry.mock.latestRoundData.returns(
                0,
                42,
                0,
                blockTimestamp,
                0
            );
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, eth);

            expect(result[0]).to.be.true;
            expect(result[1]).to.equal(42);
        });

        it("should return 0 as a price if the feed registry returns a negative price", async function () {
            const blockTimestamp = await getBlockTimestamp();

            await mockFeedRegistry.mock.latestRoundData.returns(
                0,
                -42,
                0,
                blockTimestamp,
                0
            );
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, eth);

            expect(result[0]).to.be.true;
            expect(result[1]).to.equal(0);
        });

        it("should return 0 as a price for base wbtc if the feed registry returns a negative price", async function () {
            const blockTimestamp = await getBlockTimestamp();

            await mockFeedRegistry.mock.latestRoundData.returns(
                0,
                -42,
                0,
                blockTimestamp,
                0
            );
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(wbtc, eth);

            expect(result[0]).to.be.true;
            expect(result[1]).to.equal(0);
        });

        it("should return 0 as a price if the feed registry returns updatedAt value higher than the maximum", async function () {
            await mockFeedRegistry.mock.latestRoundData.returns(0, 42, 0, 5, 0);
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, eth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });


        it("should return 0 as a price for base wbtc if the feed registry returns updatedAt value higher than the maximum", async function () {
            await mockFeedRegistry.mock.latestRoundData.returns(0, 42, 0, 5, 0);
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(wbtc, eth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });


        it("should return false and 0 if latestRoundData reverts", async function () {
            await mockFeedRegistry.mock.latestRoundData.reverts();
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(token, weth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });

        it("should return false and 0 if latestRoundData reverts for base wbtc", async function () {
            await mockFeedRegistry.mock.latestRoundData.reverts();
            await mockFeedRegistry.mock.decimals.returns(18);

            const result = await chainlinkOracleAdapter.getPrice(wbtc, weth);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });

        it("should return false and 0 if the quote asset is not weth or 0xEee", async function () {
            const result = await chainlinkOracleAdapter.getPrice(wbtc, token);

            expect(result[0]).to.be.false;
            expect(result[1]).to.equal(0);
        });
    });
});