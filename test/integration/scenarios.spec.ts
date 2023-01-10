import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { BigNumber, ContractFactory } from "ethers";
import { getBlockTimestamp, setNextBlockTimestamp } from "../helpers/helpers";
import { ONE_DAY, testAssetsPrices } from "../helpers/constants";
import {
    TestERC20,
    OracleManager,
    Pool,
    PoolFactory,
    Router,
    TestOracle,
} from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

let 
    owner: SignerWithAddress,
    borrower: SignerWithAddress,
    lender1: SignerWithAddress,
    lender2: SignerWithAddress,
    lender3: SignerWithAddress,
    lender4: SignerWithAddress,
    treasury: SignerWithAddress,
    router: Router,
    tokenA: TestERC20,
    lentAsset: TestERC20,
    tokenC: TestERC20,
    tokenD: TestERC20,
    tokenE: TestERC20,
    tokenF: TestERC20,
    activeAt: number,
    maturesAt: number,
    poolFactory: PoolFactory,
    pool: Pool,
    testOracle: TestOracle,
    oracleManager: OracleManager;

describe("Scenarios", function () {
    async function fixture() {
        const fakeAddress = "0x0101010101010101010101010101010101010101";

        [owner, borrower, lender1, lender2, lender3, lender4, treasury] =
            await ethers.getSigners();
        const RouterFactory: ContractFactory = await ethers.getContractFactory(
            "Router"
        );
        router = (await RouterFactory.deploy()) as Router;

        const TestERC20Factory = await ethers.getContractFactory("TestERC20");
        tokenA = (await TestERC20Factory.deploy()) as TestERC20;
        lentAsset = (await TestERC20Factory.deploy()) as TestERC20;
        tokenC = (await TestERC20Factory.deploy()) as TestERC20;
        tokenD = (await TestERC20Factory.deploy()) as TestERC20;
        tokenE = (await TestERC20Factory.deploy()) as TestERC20;
        tokenF = (await TestERC20Factory.deploy()) as TestERC20;

        const TestOracleFactory = await ethers.getContractFactory("TestOracle");
        testOracle = (await TestOracleFactory.deploy(
            [
                tokenA.address,
                lentAsset.address,
                tokenC.address,
                tokenD.address,
                tokenE.address,
                tokenF.address,
            ],
            testAssetsPrices
        )) as TestOracle;

        const OracleManagerFactory = await ethers.getContractFactory(
            "OracleManager"
        );
        oracleManager = (await OracleManagerFactory.deploy(
            fakeAddress
        )) as OracleManager;

        const PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
        poolFactory = (await PoolFactoryFactory.deploy(
            router.address
        )) as PoolFactory;

        await router.setFactory(poolFactory.address);

        await router.setOracleManager(oracleManager.address);
        await router.setTreasury(treasury.address);

        await oracleManager.setOracles([testOracle.address]);
    }

    beforeEach(async function () {
        await loadFixture(fixture);
    });

    it("E2E Pool (happy path)", async function () {
        const currentTimestamp = await getBlockTimestamp();
        activeAt = currentTimestamp + ONE_DAY;
        maturesAt = currentTimestamp + ONE_DAY * 200;

        const poolParams = {
            lentAsset: lentAsset.address,
            collateralAssets: [
                tokenA.address,
                tokenC.address,
                tokenD.address,
                tokenE.address,
                tokenF.address,
            ],
            coupon: ethers.utils.parseUnits("0.16", 18), // 16%
            ltv: ethers.utils.parseUnits("2", 18), // 200% = collateralization ratio 50%
            activeAt,
            maturesAt,
            minSupply: ethers.utils.parseEther("10"),
            maxSupply: ethers.utils.parseEther("100"),
            whitelistedLender: ethers.constants.AddressZero,
        };

        console.log(
            "Borrower > Approve PoolFactory for upfront lent asset amount. (5 units)"
        );
        const upfront = poolParams.coupon
            .mul(poolParams.maxSupply)
            .div(ethers.utils.parseEther("1"));
        await lentAsset.connect(borrower).mint(upfront);
        await lentAsset.connect(borrower).approve(poolFactory.address, upfront);

        console.log("Borrower > Create pool");
        await poolFactory
            .connect(borrower)
            .createPool(
                poolParams.lentAsset,
                poolParams.collateralAssets,
                poolParams.coupon,
                poolParams.ltv,
                poolParams.activeAt,
                poolParams.maturesAt,
                poolParams.minSupply,
                poolParams.maxSupply,
                poolParams.whitelistedLender
            );

        const poolId = 0;
        const poolAddress = await poolFactory.pidToPoolAddress(poolId);
        const PoolFactory = await ethers.getContractFactory("Pool");
        const pool = PoolFactory.attach(poolAddress) as Pool;

        console.log("Lender 1 > Deposit 5 lent asset");
        const lender1DepositAmount = ethers.utils.parseEther("5");
        await lentAsset.connect(lender1).mint(lender1DepositAmount);
        await lentAsset
            .connect(lender1)
            .approve(router.address, lender1DepositAmount);
        await router.connect(lender1).deposit(poolId, lender1DepositAmount);

        console.log("Lender 2 > Deposit 2 lent asset");
        const lender2DepositAmount = ethers.utils.parseEther("2");
        await lentAsset.connect(lender2).mint(lender2DepositAmount);
        await lentAsset
            .connect(lender2)
            .approve(router.address, lender2DepositAmount);
        await router.connect(lender2).deposit(poolId, lender2DepositAmount);

        console.log("Lender 3 > Deposit 3 lent asset");
        const lender3DepositAmount = ethers.utils.parseEther("3");
        await lentAsset.connect(lender3).mint(lender3DepositAmount);
        await lentAsset
            .connect(lender3)
            .approve(router.address, lender3DepositAmount);
        await router.connect(lender3).deposit(poolId, lender3DepositAmount);

        console.log("Lender 4 > Deposit 20 lent asset (in 4 chunks)");
        const lender4DepositAmount = ethers.utils.parseEther("20");
        await lentAsset.connect(lender4).mint(lender4DepositAmount);
        await lentAsset
            .connect(lender4)
            .approve(router.address, lender4DepositAmount);
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));

        console.log("🧾 A total of 30 units deposited.");

        await setNextBlockTimestamp(activeAt);
        console.log("\n⌛ The pool is now active ⌛");

        console.log("Borrower > Borrow 30 units, providing collateral.");
        const collateralAmount = ethers.utils.parseEther("30");
        await tokenA.connect(borrower).mint(collateralAmount);
        await tokenA.connect(borrower).approve(router.address, collateralAmount);

        const borrowerLentAssetBalanceBeforeBorrow = await lentAsset.balanceOf(
            borrower.address
        );
        const treasuryLentAssetBalanceBeforeBorrow = await lentAsset.balanceOf(
            treasury.address
        );
        await router
            .connect(borrower)
            .borrow(poolId, [tokenA.address], [collateralAmount]);
        const borrowerLentAssetBalanceAfterBorrow = await lentAsset.balanceOf(
            borrower.address
        );
        const treasuryLentAssetBalanceAfterBorrow = await lentAsset.balanceOf(
            treasury.address
        );

        console.log("Treasury should receive origination fee ✅");
        expect(treasuryLentAssetBalanceAfterBorrow).to.be.equal(
            treasuryLentAssetBalanceBeforeBorrow.add(
                collateralAmount
                    .mul(await poolFactory.originationFee())
                    .div(ethers.utils.parseEther("1"))
            )
        );

        console.log("Borrower should receive the rest ✅");
        expect(borrowerLentAssetBalanceAfterBorrow).to.be.equal(
            borrowerLentAssetBalanceBeforeBorrow
                .add(collateralAmount)
                .sub(treasuryLentAssetBalanceAfterBorrow)
                .sub(treasuryLentAssetBalanceBeforeBorrow)
        );

        console.log("Borrower > Repay all debt.");
        const repayAmount = ethers.utils.parseEther("30");
        await lentAsset.connect(borrower).mint(repayAmount);
        await lentAsset.connect(borrower).approve(router.address, repayAmount);
        await router.connect(borrower).repay(poolId, repayAmount);

        await setNextBlockTimestamp(maturesAt);
        console.log("\n⌛ The pool is now mature ⌛");

        console.log("Lender 1 > Redeem deposit + interest.");
        await router.connect(lender1).redeem(poolId);

        console.log("Lender 1 should receive deposit + interest ✅");
        const lender1BalanceAfterRedeem = await lentAsset.balanceOf(
            lender1.address
        );
        const lender1CouponAmount = lender1DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        expect(lender1BalanceAfterRedeem).to.equal(
            lender1DepositAmount.add(lender1CouponAmount)
        );

        console.log("Lender 2 > Redeem deposit + interest.");
        await router.connect(lender2).redeem(poolId);

        console.log("Lender 2 should receive deposit + interest ✅");
        const lender2BalanceAfterRedeem = await lentAsset.balanceOf(
            lender2.address
        );
        const lender2CouponAmount = lender2DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        expect(lender2BalanceAfterRedeem).to.equal(
            lender2DepositAmount.add(lender2CouponAmount)
        );

        console.log("Lender 3 > Redeem deposit + interest.");
        await router.connect(lender3).redeem(poolId);

        console.log("Lender 3 should receive deposit + interest ✅");
        const lender3BalanceAfterRedeem = await lentAsset.balanceOf(
            lender3.address
        );
        const lender3CouponAmount = lender3DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        expect(lender3BalanceAfterRedeem).to.equal(
            lender3DepositAmount.add(lender3CouponAmount)
        );

        console.log("Lender 4 > Redeem deposit + interest.");
        await router.connect(lender4).redeem(poolId);

        console.log("Lender 4 should receive deposit + interest ✅");
        const lender4BalanceAfterRedeem = await lentAsset.balanceOf(
            lender4.address
        );
        const lender4CouponAmount = lender4DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        expect(lender4BalanceAfterRedeem).to.equal(
            lender4DepositAmount.add(lender4CouponAmount)
        );

        const borrowerLentAssetBalanceBeforeWithdraw = await lentAsset.balanceOf(
            borrower.address
        );

        console.log("Borrower > Withdraw redundant rewards");
        await router.connect(borrower).withdrawLeftovers(0);

        console.log(
            "Borrower should receive 70% of upfront back (pool was 30% filled) = 3.5 units ✅"
        );
        const borrowerLentAssetBalanceAfterWithdraw = await lentAsset.balanceOf(
            borrower.address
        );
        expect(borrowerLentAssetBalanceAfterWithdraw).to.equal(
            borrowerLentAssetBalanceBeforeWithdraw.add(upfront.mul(7).div(10))
        );

        console.log("🧾 The pool should now be empty.");
        expect(await lentAsset.balanceOf(pool.address)).to.equal(0);
        console.log("Pool should have 0 lent asset in it ✅");
        expect(await tokenA.balanceOf(pool.address)).to.equal(0);
        console.log("Pool should have 0 collateral in it ✅");
    });

    it("E2E Pool (borrower defaults with partial repayment)", async function () {
        const currentTimestamp = await getBlockTimestamp();
        activeAt = currentTimestamp + ONE_DAY;
        maturesAt = currentTimestamp + ONE_DAY * 200;

        const poolParams = {
            lentAsset: lentAsset.address,
            collateralAssets: [
                tokenA.address,
                tokenC.address,
                tokenD.address,
                tokenE.address,
                tokenF.address,
            ],
            coupon: ethers.utils.parseUnits("0.16", 18), // 16%
            ltv: ethers.utils.parseUnits("2", 18), // 200% = collateralization ratio 50%
            activeAt,
            maturesAt,
            minSupply: ethers.utils.parseEther("10"),
            maxSupply: ethers.utils.parseEther("100"),
            whitelistedLender: ethers.constants.AddressZero,
        };

        console.log(
            "Borrower > Approve PoolFactory for upfront lent asset amount. (5 units)"
        );
        const upfront = poolParams.coupon
            .mul(poolParams.maxSupply)
            .div(ethers.utils.parseEther("1"));
        await lentAsset.connect(borrower).mint(upfront);
        await lentAsset.connect(borrower).approve(poolFactory.address, upfront);

        console.log("Borrower > Create pool");
        await poolFactory
            .connect(borrower)
            .createPool(
                poolParams.lentAsset,
                poolParams.collateralAssets,
                poolParams.coupon,
                poolParams.ltv,
                poolParams.activeAt,
                poolParams.maturesAt,
                poolParams.minSupply,
                poolParams.maxSupply,
                poolParams.whitelistedLender
            );

        const poolId = 0;
        const poolAddress = await poolFactory.pidToPoolAddress(poolId);
        const PoolFactory = await ethers.getContractFactory("Pool");
        const pool = PoolFactory.attach(poolAddress) as Pool;

        console.log("Lender 1 > Deposit 5 lent asset");
        const lender1DepositAmount = ethers.utils.parseEther("5");
        await lentAsset.connect(lender1).mint(lender1DepositAmount);
        await lentAsset
            .connect(lender1)
            .approve(router.address, lender1DepositAmount);
        await router.connect(lender1).deposit(poolId, lender1DepositAmount);

        console.log("Lender 2 > Deposit 2 lent asset");
        const lender2DepositAmount = ethers.utils.parseEther("2");
        await lentAsset.connect(lender2).mint(lender2DepositAmount);
        await lentAsset
            .connect(lender2)
            .approve(router.address, lender2DepositAmount);
        await router.connect(lender2).deposit(poolId, lender2DepositAmount);

        console.log("Lender 3 > Deposit 3 lent asset");
        const lender3DepositAmount = ethers.utils.parseEther("3");
        await lentAsset.connect(lender3).mint(lender3DepositAmount);
        await lentAsset
            .connect(lender3)
            .approve(router.address, lender3DepositAmount);
        await router.connect(lender3).deposit(poolId, lender3DepositAmount);

        console.log("Lender 4 > Deposit 20 lent asset (in 4 chunks)");
        const lender4DepositAmount = ethers.utils.parseEther("20");
        await lentAsset.connect(lender4).mint(lender4DepositAmount);
        await lentAsset
            .connect(lender4)
            .approve(router.address, lender4DepositAmount);
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));
        await router.connect(lender4).deposit(poolId, lender4DepositAmount.div(4));

        console.log("🧾 A total of 30 units deposited.");

        await setNextBlockTimestamp(activeAt);
        console.log("\n⌛ The pool is now active ⌛");

        console.log("Borrower > Borrow 30 units, providing collateral.");
        const collateralAmount = ethers.utils.parseEther("30");
        await tokenA.connect(borrower).mint(collateralAmount);
        await tokenA.connect(borrower).approve(router.address, collateralAmount);

        const borrowerLentAssetBalanceBeforeBorrow = await lentAsset.balanceOf(
            borrower.address
        );
        const treasuryLentAssetBalanceBeforeBorrow = await lentAsset.balanceOf(
            treasury.address
        );
        await router
            .connect(borrower)
            .borrow(poolId, [tokenA.address], [collateralAmount]);
        const borrowerLentAssetBalanceAfterBorrow = await lentAsset.balanceOf(
            borrower.address
        );
        const treasuryLentAssetBalanceAfterBorrow = await lentAsset.balanceOf(
            treasury.address
        );

        console.log("Treasury should receive origination fee ✅");
        expect(treasuryLentAssetBalanceAfterBorrow).to.be.equal(
            treasuryLentAssetBalanceBeforeBorrow.add(
                collateralAmount
                    .mul(await poolFactory.originationFee())
                    .div(ethers.utils.parseEther("1"))
            )
        );

        console.log("Borrower should receive the rest ✅");
        expect(borrowerLentAssetBalanceAfterBorrow).to.be.equal(
            borrowerLentAssetBalanceBeforeBorrow
                .add(collateralAmount)
                .sub(treasuryLentAssetBalanceAfterBorrow)
                .sub(treasuryLentAssetBalanceBeforeBorrow)
        );

        console.log("Borrower > Repay 10 units of debt (in 4 chunks).");
        const repayAmount = ethers.utils.parseEther("10");
        await lentAsset.connect(borrower).mint(repayAmount);
        await lentAsset.connect(borrower).approve(router.address, repayAmount);
        await router.connect(borrower).repay(poolId, repayAmount.div(4));
        await router.connect(borrower).repay(poolId, repayAmount.div(4));
        await router.connect(borrower).repay(poolId, repayAmount.div(4));
        await router.connect(borrower).repay(poolId, repayAmount.div(4));

        await setNextBlockTimestamp(maturesAt);
        console.log("\n⌛ The pool is now mature ⌛");

        console.log("Lender 1 > Redeem default.");
        await router.connect(lender1).redeem(poolId);

        console.log(await tokenA.balanceOf(lender1.address));
        console.log(
            "Lender 1 should receive yield + pro-rata lent asset + pro-rata collateral ✅"
        );
        const lender1LentAssetBalanceAfterRedeem = await lentAsset.balanceOf(
            lender1.address
        );

        const lender1LentAssetCouponAmount = lender1DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        const lender1ProrataLentAssetAmount = lender1DepositAmount
            .mul(repayAmount)
            .div(ethers.utils.parseEther("30"));
        const lender1ProrataCollateralAmount = lender1DepositAmount
            .mul(repayAmount)
            .div(ethers.utils.parseEther("30"));
        expect(lender1LentAssetBalanceAfterRedeem).to.equal(
            lender1LentAssetCouponAmount.add(lender1ProrataLentAssetAmount)
        );

        console.log("Lender 2 > Redeem default.");
        await router.connect(lender2).redeem(poolId);

        console.log(
            "Lender 2 should receive yield + pro-rata lent asset + pro-rata collateral ✅"
        );
        const lender2LentAssetBalanceAfterRedeem = await lentAsset.balanceOf(
            lender2.address
        );

        const lender2LentAssetCouponAmount = lender2DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        const lender2ProrataLentAssetAmount = lender2DepositAmount
            .mul(repayAmount)
            .div(ethers.utils.parseEther("30"));
        expect(lender2LentAssetBalanceAfterRedeem).to.equal(
            lender2LentAssetCouponAmount.add(lender2ProrataLentAssetAmount)
        );

        console.log("Lender 3 > Redeem default.");
        await router.connect(lender3).redeem(poolId);

        console.log(
            "Lender 3 should receive yield + pro-rata lent asset + pro-rata collateral ✅"
        );
        const lender3LentAssetBalanceAfterRedeem = await lentAsset.balanceOf(
            lender3.address
        );

        const lender3LentAssetCouponAmount = lender3DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        const lender3ProrataLentAssetAmount = lender3DepositAmount
            .mul(repayAmount)
            .div(ethers.utils.parseEther("30"));
        expect(lender3LentAssetBalanceAfterRedeem).to.equal(
            lender3LentAssetCouponAmount.add(lender3ProrataLentAssetAmount)
        );

        console.log("Lender 4 > Redeem default.");
        await router.connect(lender4).redeem(poolId);

        console.log(
            "Lender 4 should receive yield + pro-rata lent asset + pro-rata collateral ✅"
        );
        const lender4LentAssetBalanceAfterRedeem = await lentAsset.balanceOf(
            lender4.address
        );

        const lender4LentAssetCouponAmount = lender4DepositAmount
            .mul(poolParams.coupon)
            .div(ethers.utils.parseEther("1"));
        const lender4ProrataLentAssetAmount = lender4DepositAmount
            .mul(repayAmount)
            .div(ethers.utils.parseEther("30"));
        expect(lender4LentAssetBalanceAfterRedeem).to.equal(
            lender4LentAssetCouponAmount.add(lender4ProrataLentAssetAmount)
        );

        const borrowerLentAssetBalanceBeforeWithdraw = await lentAsset.balanceOf(
            borrower.address
        );

        console.log("Borrower > Withdraw redundant rewards");
        await router.connect(borrower).withdrawLeftovers(0);

        console.log(
            "Borrower should receive 70% of upfront back (pool was 30% filled) = 3.5 units ✅"
        );
        const borrowerLentAssetBalanceAfterWithdraw = await lentAsset.balanceOf(
            borrower.address
        );
        expect(borrowerLentAssetBalanceAfterWithdraw).to.equal(
            borrowerLentAssetBalanceBeforeWithdraw.add(upfront.mul(7).div(10))
        );

        console.log("🧾 The pool should now be empty.");
        expect(await lentAsset.balanceOf(pool.address)).to.be.lt(10);
        console.log("Pool should have (near) 0 lent asset in it ✅");
        expect(await tokenA.balanceOf(pool.address)).to.lt(10);
        console.log("Pool should have (near) 0 collateral in it ✅");
    });
});