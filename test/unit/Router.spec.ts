import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ContractFactory } from "ethers";
import { setNextBlockTimestamp } from "../helpers/helpers";
import {
  coupon,
  ltv,
  FUNDING_PORTION,
  ONE_ETHER,
  TEN_ETHER,
  testAssetsPrices,
} from "../helpers/constants";
import {
  TestERC20,
  OracleManager,
  Pool,
  PoolFactory,
  Router,
  TestOracle,
} from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { loadFixture } = waffle;

const minSupply = ethers.utils.parseEther("10");
const maxSupply = ethers.utils.parseEther("100");

const activeAt = 3000000000;
const maturesAt = 4000000000;

let owner: SignerWithAddress,
  lender1: SignerWithAddress,
  lender2: SignerWithAddress,
  treasury: SignerWithAddress,
  outsider: SignerWithAddress,
  router: Router,
  tokenA: TestERC20,
  tokenB: TestERC20,
  tokenC: TestERC20,
  tokenD: TestERC20,
  tokenE: TestERC20,
  tokenF: TestERC20,
  poolFactory: PoolFactory,
  pool: Pool,
  testOracle: TestOracle,
  oracleManager: OracleManager;

describe("Router", function () {
  async function fixture() {
    const fakeAddress = "0x0101010101010101010101010101010101010101";

    [owner, lender1, lender2, treasury, outsider] = await ethers.getSigners();

    const RouterFactory: ContractFactory = await ethers.getContractFactory(
      "Router"
    );
    router = (await RouterFactory.deploy()) as Router;

    const TestERC20Factory = await ethers.getContractFactory("TestERC20");
    tokenA = (await TestERC20Factory.deploy()) as TestERC20;
    tokenB = (await TestERC20Factory.deploy()) as TestERC20;
    tokenC = (await TestERC20Factory.deploy()) as TestERC20;
    tokenD = (await TestERC20Factory.deploy()) as TestERC20;
    tokenE = (await TestERC20Factory.deploy()) as TestERC20;
    tokenF = (await TestERC20Factory.deploy()) as TestERC20;

    const TestOracleFactory = await ethers.getContractFactory("TestOracle");
    testOracle = (await TestOracleFactory.deploy(
      [
        tokenA.address,
        tokenB.address,
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

    await tokenA.mint(TEN_ETHER.mul(100)); // mint 10 tokenA to owner
    await tokenA.approve(router.address, TEN_ETHER.mul(100));

    await tokenC.mint(TEN_ETHER); // mint 10 tokenC to owner
    await tokenC.approve(router.address, TEN_ETHER);

    await tokenD.mint(TEN_ETHER); // mint 10 tokenD to owner
    await tokenD.approve(router.address, TEN_ETHER);

    await tokenE.mint(TEN_ETHER); // mint 10 tokenE to owner
    await tokenE.approve(router.address, TEN_ETHER);

    await tokenF.mint(TEN_ETHER); // mint 10 tokenF to owner
    await tokenF.approve(router.address, TEN_ETHER);

    await tokenB.connect(owner).mint(FUNDING_PORTION.mul(100)); // mint 30 tokenB to owner in order to fund pool creation
    await tokenB.connect(lender1).mint(TEN_ETHER.mul(100)); // mint 10 tokenB to lender1
    await tokenB.connect(lender2).mint(TEN_ETHER.mul(100)); // mint 10 tokenB to lender2

    await tokenA
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);
    await tokenB
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);
    await tokenC
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);
    await tokenD
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);
    await tokenE
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);
    await tokenF
      .connect(owner)
      .approve(poolFactory.address, ethers.constants.MaxUint256);

    await tokenB
      .connect(owner)
      .approve(router.address, ethers.constants.MaxUint256);
    await tokenB
      .connect(lender1)
      .approve(router.address, ethers.constants.MaxUint256);
    await tokenB
      .connect(lender2)
      .approve(router.address, ethers.constants.MaxUint256);

    await poolFactory.createPool(
      tokenB.address,
      [
        tokenA.address,
        tokenC.address,
        tokenD.address,
        tokenE.address,
        tokenF.address,
      ],
      coupon,
      ltv,
      activeAt,
      maturesAt,
      minSupply,
      maxSupply,
      ethers.constants.AddressZero
    );

    const poolAddress = await poolFactory.pidToPoolAddress(0);
    const PoolFactory = await ethers.getContractFactory("Pool");
    pool = PoolFactory.attach(poolAddress) as Pool;

    await tokenB
      .connect(owner)
      .approve(poolAddress, ethers.constants.MaxUint256);
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("#deposit", function () {
    context("when validating caller", function () {
      it("should allow anybody to deposit if the pool has no whitelisted lender", async function () {
        const balanceTokenBBeforeDeposit = await tokenB.balanceOf(
          lender1.address
        );
        const poolTokenBBeforeDeposit = await tokenB.balanceOf(pool.address);

        await router.connect(lender1).deposit(0, TEN_ETHER);

        const balanceTokenBAfterDeposit = await tokenB.balanceOf(
          lender1.address
        );
        const poolTokenBAfterDeposit = await tokenB.balanceOf(pool.address);

        expect(balanceTokenBBeforeDeposit).to.eq(
          balanceTokenBAfterDeposit.add(TEN_ETHER)
        );
        expect(poolTokenBBeforeDeposit).to.eq(
          poolTokenBAfterDeposit.sub(TEN_ETHER)
        );
      });

      it("should not allow the pool's borrower to deposit", async function () {
        await expect(
          router.connect(owner).deposit(0, TEN_ETHER)
        ).to.be.revertedWith("Router::cannot be borrower");
      });

      it("should allow the whitelisted lender to deposit if the pool has a whitelisted lender", async function () {
        await poolFactory.createPool(
          tokenB.address,
          [
            tokenA.address,
            tokenC.address,
            tokenD.address,
            tokenE.address,
            tokenF.address,
          ],
          coupon,
          ltv,
          activeAt,
          maturesAt,
          minSupply,
          maxSupply,
          lender1.address
        );

        await expect(
          router.connect(lender1).deposit(1, TEN_ETHER)
        ).to.not.be.reverted;
      });

      it("should not allow a non-whitelisted lender to deposit if the pool has a whitelisted lender", async function () {
        await poolFactory.createPool(
          tokenB.address,
          [
            tokenA.address,
            tokenC.address,
            tokenD.address,
            tokenE.address,
            tokenF.address,
          ],
          coupon,
          ltv,
          activeAt,
          maturesAt,
          minSupply,
          maxSupply,
          lender1.address
        );

        await expect(
          router.connect(lender2).deposit(1, TEN_ETHER)
        ).to.be.revertedWith("Router::caller not whitelisted lender");
      });
    });

    context("when validating timestamps", function () {
      it("should not allow a deposit if the timestamp is after the pool's bonding time is over", async function () {
        await setNextBlockTimestamp(activeAt);

        await expect(
          router.connect(lender1).deposit(0, TEN_ETHER)
        ).to.be.revertedWith("Router::expired deposit period");
      });
    });

    context("when validating supply cap", function () {
      it("should not allow a deposit if the amount is greater than the supply cap", async function () {
        await tokenB.connect(lender1).mint(maxSupply.add(1));
        await expect(
          router.connect(lender1).deposit(0, maxSupply.add(1))
        ).to.be.revertedWith("Router::supply cap exceeded");
      });

      it("should not allow a deposit if the amount will raise the total deposits above the supply cap", async function () {
        const lender1DepositAmount = maxSupply.div(3);
        const lender2DepositAmount = maxSupply.sub(lender1DepositAmount).add(1);

        await tokenB.connect(lender1).mint(lender1DepositAmount);
        router.connect(lender1).deposit(0, lender1DepositAmount);

        await tokenB.connect(lender2).mint(lender2DepositAmount);
        await expect(
          router.connect(lender2).deposit(0, lender2DepositAmount)
        ).to.be.revertedWith("Router::supply cap exceeded");
      });
    });

    context("when validating external conditions", function () {
      it("should not allow a deposit if the contract is paused", async function () {
        await router.pause();

        await expect(
          router.connect(lender1).deposit(0, TEN_ETHER)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should not allow a deposit if the token transfer fails", async function () {
        await tokenB.connect(lender1).approve(router.address, TEN_ETHER.sub(1));

        await expect(
          router.connect(lender1).deposit(0, TEN_ETHER)
        ).to.be.reverted;
      });

      it("should not allow a deposit if the pool does not exist", async function () {
        await tokenB.connect(lender1).approve(router.address, TEN_ETHER.sub(1));

        await expect(
          router.connect(lender1).deposit(1, TEN_ETHER)
        ).to.be.revertedWith("Router::no pool");
      });
    });
  });

  describe("#borrow", function () {
    context("when executing the action", function () {
      it("should allow the borrower to borrow", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.not.be.reverted;
      });

      it("should emit Borrow when borrow is called", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(router.borrow(0, [tokenA.address], [TEN_ETHER]))
          .to.emit(router, "Borrow")
          .withArgs(0, TEN_ETHER, [tokenA.address], [TEN_ETHER]);
      });

      it("should correctly move assets between borrower and pool when borrow is called", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);
        // before borrow
        const [
          poolBalanceOfCollateralToken,
          ownerBalanceOfCollateralToken,
          lenderBalanceOfCollateralToken,
          treasuryBalanceOfCollateralToken,
          poolBalanceOfLentToken,
          ownerBalanceOfLentToken,
          lenderBalanceOfLentToken,
          treasuryBalanceOfLentToken,
        ] = await Promise.all([
          tokenA.balanceOf(pool.address),
          tokenA.balanceOf(owner.address),
          tokenA.balanceOf(lender1.address),
          tokenA.balanceOf(treasury.address),
          tokenB.balanceOf(pool.address),
          tokenB.balanceOf(owner.address),
          tokenB.balanceOf(lender1.address),
          tokenB.balanceOf(treasury.address),
        ]);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        // after borrow
        const [
          poolBalanceOfCollateralToken1,
          ownerBalanceOfCollateralToken1,
          lenderBalanceOfCollateralToken1,
          treasuryBalanceOfCollateralToken1,
          poolBalanceOfLentToken1,
          ownerBalanceOfLentToken1,
          lenderBalanceOfLentToken1,
          treasuryBalanceOfLentToken1,
        ] = await Promise.all([
          tokenA.balanceOf(pool.address),
          tokenA.balanceOf(owner.address),
          tokenA.balanceOf(lender1.address),
          tokenA.balanceOf(treasury.address),
          tokenB.balanceOf(pool.address),
          tokenB.balanceOf(owner.address),
          tokenB.balanceOf(lender1.address),
          tokenB.balanceOf(treasury.address),
        ]);

        const originationFee = await poolFactory.originationFee();
        const originationFeeAmt = originationFee
          .mul(TEN_ETHER)
          .div(ethers.utils.parseEther("1"));

        expect(
          poolBalanceOfCollateralToken1.sub(poolBalanceOfCollateralToken)
        ).to.eq(TEN_ETHER);

        expect(poolBalanceOfLentToken.sub(poolBalanceOfLentToken1)).to.eq(
          TEN_ETHER
        );

        expect(
          ownerBalanceOfCollateralToken.sub(ownerBalanceOfCollateralToken1)
        ).to.eq(TEN_ETHER);

        expect(ownerBalanceOfLentToken1.sub(ownerBalanceOfLentToken)).to.eq(
          TEN_ETHER.sub(originationFeeAmt)
        );

        expect(
          treasuryBalanceOfLentToken1.sub(treasuryBalanceOfLentToken)
        ).to.eq(originationFeeAmt);

        expect(lenderBalanceOfCollateralToken).to.eq(
          lenderBalanceOfCollateralToken1
        );
        expect(lenderBalanceOfLentToken).to.eq(lenderBalanceOfLentToken1);
        expect(treasuryBalanceOfCollateralToken).to.eq(
          treasuryBalanceOfCollateralToken1
        );
      });

      it("should not allow a non-borrower to borrow", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.connect(lender1).borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::caller not borrower");
      });

      it("should revert if borrowed asset is out of service", async function () {
        await testOracle.setAssetStatus(tokenB.address, true);

        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("OracleManager::not supported");
      });
    });

    context("when validating collateral assets", function () {
      it("should fail if the length of the supplied collateral assets is larger than the length of the amounts", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address, tokenC.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::invalid params");
      });

      it("should fail if the length of the supplied collateral assets is smaller than the length of the amounts", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [tokenA.address],
            [TEN_ETHER.div(2), TEN_ETHER.div(2)]
          )
        ).to.be.revertedWith("Router::invalid params");
      });

      it("should fail if a supplied collateral asset is not pool collateral (in the beginning)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenB.address,
              tokenC.address,
              tokenD.address,
              tokenE.address,
              tokenF.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should fail if a supplied collateral asset is not pool collateral (in the middle)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenC.address,
              tokenB.address,
              tokenE.address,
              tokenF.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should fail if a supplied collateral asset is not pool collateral (at the end)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenC.address,
              tokenD.address,
              tokenE.address,
              tokenB.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should fail if the supplied collateral assets contain a duplicate (in the beginning)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenA.address,
              tokenD.address,
              tokenE.address,
              tokenF.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should fail if the supplied collateral assets contain a duplicate (in the middle)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenC.address,
              tokenD.address,
              tokenD.address,
              tokenF.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should fail if the supplied collateral assets contain a duplicate (at the end)", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenC.address,
              tokenD.address,
              tokenE.address,
              tokenE.address,
            ],
            [
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
              TEN_ETHER.div(5),
            ]
          )
        ).to.be.revertedWith("Router::invalid assets");
      });

      it("should allow for 0-amount collateral to be specified", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(
            0,
            [
              tokenA.address,
              tokenC.address,
              tokenD.address,
              tokenE.address,
              tokenF.address,
            ],
            [0, 0, 0, 0, TEN_ETHER]
          )
        ).to.not.be.reverted;
      });
    });

    context("when validating timestamps", function () {
      it("should fail if the pool is still in the bonding period", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt - 1);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::can't borrow");
      });

      it("should fail if the pool has matured", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::can't borrow");
      });
    });

    context("when validating deposits", function () {
      it("should fail if the minimum supply is not reached", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER.sub(1));

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::can't borrow");
      });

      it("should fail if the borrowing power is too low for the posted collateral", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address], [1])
        ).to.be.revertedWith("Router::low BP");
      });
    });

    context("when validating origination fee", function () {
      it("should not transfer premium from borrower when the origination fee is 0", async function () {
        await poolFactory.setOriginationFee(0);
        await poolFactory.createPool(
          tokenB.address,
          [
            tokenA.address,
            tokenC.address,
            tokenD.address,
            tokenE.address,
            tokenF.address,
          ],
          coupon,
          ltv,
          activeAt,
          maturesAt,
          minSupply,
          maxSupply,
          ethers.constants.AddressZero
        );

        await router.connect(lender1).deposit(1, TEN_ETHER);

        const treasuryBalanceBefore = await tokenB.balanceOf(treasury.address);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(1, [tokenA.address], [TEN_ETHER]);

        const treasuryBalanceAfter = await tokenB.balanceOf(treasury.address);

        expect(treasuryBalanceBefore).to.eq(treasuryBalanceAfter);
      });
    });

    context("when validating external conditions", function () {
      it("should fail if the router is paused", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await router.pause();
        await setNextBlockTimestamp(activeAt);
        await expect(
          router.borrow(0, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should fail if the pool does not exist", async function () {
        await tokenB.connect(lender1).approve(router.address, TEN_ETHER.sub(1));

        await setNextBlockTimestamp(activeAt);
        await expect(
          router.connect(lender1).borrow(1, [tokenA.address], [TEN_ETHER])
        ).to.be.revertedWith("Router::no pool");
      });
    });
  });

  describe("#repay", function () {
    context("when executing the action", function () {
      it("should allow the borrower to repay before maturesAt", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(0, TEN_ETHER)).to.not.be.reverted;
      });

      it("should emit Repay when repay is called", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(0, TEN_ETHER))
          .to.emit(router, "Repay")
          .withArgs(0, tokenB.address, TEN_ETHER);
      });

      it("should correctly account the repayment", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        const poolBalanceOfCollateralToken = await tokenA.balanceOf(
          pool.address
        );
        const poolBalanceOfLentToken = await tokenB.balanceOf(pool.address);
        const ownerBalanceOfCollateralToken = await tokenA.balanceOf(
          owner.address
        );
        const ownerBalanceOfLentToken = await tokenB.balanceOf(owner.address);
        const lenderBalanceOfCollateralToken = await tokenA.balanceOf(
          lender1.address
        );
        const lenderBalanceOfLentToken = await tokenB.balanceOf(
          lender1.address
        );

        // approve tokenB to be transferred back to the pool

        await router.repay(0, TEN_ETHER);

        // after repay borrow
        const poolBalanceOfCollateralToken1 = await tokenA.balanceOf(
          pool.address
        );
        const poolBalanceOfLentToken1 = await tokenB.balanceOf(pool.address);
        const ownerBalanceOfCollateralToken1 = await tokenA.balanceOf(
          owner.address
        );
        const ownerBalanceOfLentToken1 = await tokenB.balanceOf(owner.address);
        const lenderBalanceOfCollateralToken1 = await tokenA.balanceOf(
          lender1.address
        );
        const lenderBalanceOfLentToken1 = await tokenB.balanceOf(
          lender1.address
        );

        // 10 units of collateral Pool -> Borrower
        // 10 units of lent asset Borrower -> Pool
        expect(poolBalanceOfCollateralToken1).to.eq(
          poolBalanceOfCollateralToken.sub(TEN_ETHER)
        );
        expect(poolBalanceOfLentToken1).to.eq(
          poolBalanceOfLentToken.add(TEN_ETHER)
        );

        expect(ownerBalanceOfCollateralToken1).to.eq(
          ownerBalanceOfCollateralToken.add(TEN_ETHER)
        );
        expect(ownerBalanceOfLentToken1).to.eq(
          ownerBalanceOfLentToken.sub(TEN_ETHER)
        );

        // Lender balances are unchanged
        expect(lenderBalanceOfCollateralToken).to.eq(
          lenderBalanceOfCollateralToken1
        );
        expect(lenderBalanceOfLentToken1).to.eq(lenderBalanceOfLentToken);
      });

      it("should allow anyone to repay on behalf of the borrower", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(
          router.connect(lender2).repay(0, TEN_ETHER)
        ).to.not.be.reverted;
      });
    });

    context("when validating timestamps", function () {
      it("should deny a repay after maturesAt", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.repay(0, TEN_ETHER)).to.be.revertedWith(
          "Router::not active"
        );
      });

      it("should allow a repay after maturesAt if the contract is paused", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.pause();
        await setNextBlockTimestamp(maturesAt);
        await expect(router.repay(0, TEN_ETHER)).to.not.be.reverted;
      });

      it("should fail if the pool is in the bonding period", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await expect(router.repay(0, TEN_ETHER)).to.be.revertedWith(
          "Router::not active"
        );
      });
    });

    context("when validating amounts", function () {
      it("should fail if nothing has been borrowed", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await expect(router.repay(0, TEN_ETHER)).to.be.revertedWith(
          "Router::no debt"
        );
      });

      it("should allow a partial repay", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(0, 1)).to.not.be.reverted;
      });

      it("should fail if a zero amount is repaid", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(0, 0)).to.be.revertedWith("Router::zero amt");
      });

      it("should allow multiple partial repays", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(0, TEN_ETHER.div(4))).to.not.be.reverted;

        await expect(router.repay(0, TEN_ETHER.div(4))).to.not.be.reverted;

        await expect(router.repay(0, TEN_ETHER.div(4))).to.not.be.reverted;

        await expect(router.repay(0, TEN_ETHER.div(4))).to.not.be.reverted;
      });
    });

    context("when validating external conditions", function () {
      it("should fail if the token transfer fails", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await tokenB.connect(owner).approve(router.address, 0);
        await expect(router.repay(0, TEN_ETHER)).to.be.reverted;
      });

      it("should fail if the pool does not exist", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await expect(router.repay(1, TEN_ETHER)).to.be.revertedWith(
          "Router::no pool"
        );
      });
    });
  });

  describe("#redeem", function () {
    context("when executing the action", function () {
      it("should allow the lender to redeem after maturesAt", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender1).redeem(0)).to.not.be.reverted;
      });

      it("should emit Redeem when redeem is called", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender1).redeem(0))
          .to.emit(router, "Redeem")
          .withArgs(0, tokenB.address, false);
      });

      it("should emit Redeem when redeem is called and borrower has defaulted", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender1).redeem(0))
          .to.emit(router, "Redeem")
          .withArgs(0, tokenB.address, true);
      });

      it("should correctly account the redeem", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        // before redeem
        const poolBalanceOfCollateralToken = await tokenA.balanceOf(
          pool.address
        );
        const poolBalanceOfLentToken = await tokenB.balanceOf(pool.address);
        const ownerBalanceOfCollateralToken = await tokenA.balanceOf(
          owner.address
        );
        const ownerBalanceOfLentToken = await tokenB.balanceOf(owner.address);
        const lenderBalanceOfCollateralToken = await tokenA.balanceOf(
          lender1.address
        );
        const lenderBalanceOfLentToken = await tokenB.balanceOf(
          lender1.address
        );

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        // after redeem
        const poolBalanceOfCollateralToken1 = await tokenA.balanceOf(
          pool.address
        );
        const poolBalanceOfLentToken1 = await tokenB.balanceOf(pool.address);
        const ownerBalanceOfCollateralToken1 = await tokenA.balanceOf(
          owner.address
        );
        const ownerBalanceOfLentToken1 = await tokenB.balanceOf(owner.address);
        const lenderBalanceOfCollateralToken1 = await tokenA.balanceOf(
          lender1.address
        );
        const lenderBalanceOfLentToken1 = await tokenB.balanceOf(
          lender1.address
        );

        const couponPaid = ethers.utils.parseEther("0.3");

        expect(poolBalanceOfCollateralToken1).to.eq(
          poolBalanceOfCollateralToken
        );
        expect(poolBalanceOfLentToken1).to.eq(
          poolBalanceOfLentToken.sub(TEN_ETHER.add(couponPaid))
        );
        expect(ownerBalanceOfCollateralToken).to.eq(
          ownerBalanceOfCollateralToken1
        );
        expect(ownerBalanceOfLentToken1).to.eq(ownerBalanceOfLentToken);
        expect(lenderBalanceOfCollateralToken1).to.eq(
          lenderBalanceOfCollateralToken
        );
        expect(lenderBalanceOfLentToken1).to.eq(
          lenderBalanceOfLentToken.add(TEN_ETHER.add(couponPaid))
        );
      });
    });

    context("when validating caller", function () {
      it("should not allow the borrower to redeem", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.redeem(0)).to.be.revertedWith("");
      });

      it("should not allow a non-lender to redeem", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender2).redeem(0)).to.be.revertedWith("");
      });
    });

    context("when validating timestamps", function () {
      it("should deny redeem if the pool has not reached maturesAt and the minimum has been met", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt - 1);
        await expect(router.connect(lender1).redeem(0)).to.be.revertedWith(
          "Router::can't redeem"
        );
      });

      it("should allow redeem if the pool has not reached maturesAt but the minimum supply has not been met", async function () {
        await router.connect(lender1).deposit(0, 1);

        await setNextBlockTimestamp(maturesAt - 1);
        await expect(router.connect(lender1).redeem(0)).to.not.be.reverted;
      });

      it("should deny redeem if the pool is in the bonding period", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await expect(router.connect(lender1).redeem(0)).to.be.revertedWith(
          "Router::can't redeem"
        );
      });
    });

    context("when validating past actions", function () {
      it("should not allow a lender to redeem twice", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        await expect(router.connect(lender1).redeem(0)).to.be.revertedWith(
          "Router::no notional"
        );
      });

      it("should not allow a lender to redeem if the lender has not deposited", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender2).redeem(0)).to.be.revertedWith(
          "Router::no notional"
        );
      });
    });

    context("when validating external conditions", function () {
      it("should not allow a lender to redeem if the contract is paused", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await router.pause();
        await setNextBlockTimestamp(maturesAt);
        await expect(router.connect(lender1).redeem(0)).to.be.revertedWith(
          "Pausable: paused"
        );
      });

      it("should fail if the pool does not exist", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER]);

        await router.repay(0, TEN_ETHER);

        await expect(router.connect(lender1).redeem(1)).to.be.revertedWith(
          "Router::no pool"
        );
      });
    });

    context("when handling multiple actions", function () {
      it("should allow multiple lenders to redeem", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);
        await router.connect(lender2).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER.mul(2)]);
        await router.repay(0, TEN_ETHER.mul(2));

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        await expect(router.connect(lender2).redeem(0)).to.not.be.reverted;
      });

      it("should allow multiple lenders to redeem in the case of a default and partial repay", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);
        await router.connect(lender2).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER.mul(2)]);
        await router.repay(0, TEN_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        await expect(router.connect(lender2).redeem(0)).to.not.be.reverted;
      });

      it("should allow multiple lenders to redeem in the case of a default and no repay", async function () {
        await router.connect(lender1).deposit(0, TEN_ETHER);
        await router.connect(lender2).deposit(0, TEN_ETHER);

        await setNextBlockTimestamp(activeAt);
        await router.borrow(0, [tokenA.address], [TEN_ETHER.mul(2)]);

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        await expect(router.connect(lender2).redeem(0)).to.not.be.reverted;
      });

      it("should allow multiple lenders to redeem in the case of an undersubscription", async function () {
        await router.connect(lender1).deposit(0, 5);
        await router.connect(lender2).deposit(0, 5);

        await setNextBlockTimestamp(maturesAt);
        await router.connect(lender1).redeem(0);

        await expect(router.connect(lender2).redeem(0)).to.not.be.reverted;
      });
    });
  });

  describe("#withdrawLeftovers", function () {
    context("when executing the action", function () {
      it("should allow the borrower to withdraw leftover rewards", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.withdrawLeftovers(0)).to.not.be.reverted;
      });

      it("should emit LeftoversWithdrawn when a withdraw is made", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.withdrawLeftovers(0))
          .to.emit(router, "LeftoversWithdrawn")
          .withArgs(0, ethers.utils.parseUnits("3", 18));
      });

      it("should return the full upfront to the borrower if the minimum is not reached", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);

        const ownerBalanceBefore = await tokenB.balanceOf(owner.address);
        const poolBalanceBefore = await tokenB.balanceOf(pool.address);
        await router.withdrawLeftovers(0);
        const ownerBalanceAfter = await tokenB.balanceOf(owner.address);
        const poolBalanceAfter = await tokenB.balanceOf(pool.address);

        expect(poolBalanceAfter).to.eq(ONE_ETHER);
        expect(ownerBalanceAfter).to.eq(
          ownerBalanceBefore.add(poolBalanceBefore).sub(poolBalanceAfter)
        );
      });
    });

    context("when validating caller", function () {
      it("should fail if the caller is not the borrower", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(
          router.connect(lender1).withdrawLeftovers(0)
        ).to.be.revertedWith("Router::not borrower");
      });
    });

    context("when validating past actions", function () {
      it("should not allow the borrower to withdraw more than once", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await router.withdrawLeftovers(0);
        await expect(router.withdrawLeftovers(0)).to.be.reverted;
      });
    });

    context("when validating timestamps", function () {
      it("should fail if the pool is not active", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(activeAt - 1);
        await expect(router.withdrawLeftovers(0)).to.be.revertedWith("Router::not active");
      });
    });

    context("when validating reserves", function () {
      it("should return the full upfront to the borrower if total deposits < minimum", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);

        const ownerBalanceBefore = await tokenB.balanceOf(owner.address);
        const poolBalanceBefore = await tokenB.balanceOf(pool.address);
        await router.withdrawLeftovers(0);
        const ownerBalanceAfter = await tokenB.balanceOf(owner.address);
        const poolBalanceAfter = await tokenB.balanceOf(pool.address);

        expect(poolBalanceAfter).to.eq(ONE_ETHER);
        expect(ownerBalanceAfter).to.eq(
          ownerBalanceBefore.add(poolBalanceBefore).sub(poolBalanceAfter)
        );
      });
      it("should return a proportion of the upfront if the minimum < total deposits < maximum", async function () {
        const depositAmount = TEN_ETHER.mul(10);
        await router.connect(lender1).deposit(0, depositAmount);

        await setNextBlockTimestamp(maturesAt);

        const ownerBalanceBefore = await tokenB.balanceOf(owner.address);
        const poolBalanceBefore = await tokenB.balanceOf(pool.address);
        await router.withdrawLeftovers(0);
        const ownerBalanceAfter = await tokenB.balanceOf(owner.address);
        const poolBalanceAfter = await tokenB.balanceOf(pool.address);

        const supply = await pool.supply();

        const withdrawnAmount = coupon
          .mul(maxSupply.sub(supply))
          .div(ethers.utils.parseEther("1"));

        expect(poolBalanceAfter).to.eq(poolBalanceBefore.sub(withdrawnAmount));
        expect(ownerBalanceAfter).to.eq(
          ownerBalanceBefore.add(withdrawnAmount)
        );
      });
    });

    context("when validating external conditions", function () {
      it("should fail if the router is paused", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await router.pause();
        await setNextBlockTimestamp(maturesAt);
        await expect(router.withdrawLeftovers(0)).to.be.revertedWith(
          "Pausable: paused"
        );
      });

      it("should fail if the pool does not exist", async function () {
        await router.connect(lender1).deposit(0, ONE_ETHER);

        await setNextBlockTimestamp(maturesAt);
        await expect(router.withdrawLeftovers(1)).to.be.revertedWith(
          "Router::no pool"
        );
      });
    });
  });

  describe("#setFactory", function () {
    const newFactory = "0x0101010101010101010101010101010101010101";

    it("should allow the owner to set the factory to a non-zero address", async function () {
      const RouterFactory: ContractFactory = await ethers.getContractFactory(
        "Router"
      );

      const router2 = (await RouterFactory.deploy()) as Router;

      await expect(router2.setFactory(newFactory)).to.not.be.reverted;
    });

    it("should emit FactorySet when the factory is set", async function () {
      const RouterFactory: ContractFactory = await ethers.getContractFactory(
        "Router"
      );

      const router2 = (await RouterFactory.deploy()) as Router;

      await expect(router2.setFactory(newFactory))
        .to.emit(router2, "FactorySet")
    });

    it("should not allow the owner to set the factory to the zero address", async function () {
      await expect(router.setFactory(ethers.constants.AddressZero)).to.be
        .reverted;
    });

    it("should not allow a non-owner to set the factory", async function () {
      await expect(router.connect(outsider).setFactory(newFactory)).to.be
        .reverted;
    });

    it("should not allow a factory to be changed after being set", async function () {
      await expect(router.setFactory(newFactory)).to.be.reverted;
    });

  });

  describe("#setOracleManager", function () {
    const newOracleManager = "0x0101010101010101010101010101010101010101";

    it("should allow the owner to set the oracle manager to a non-zero address", async function () {
      await expect(router.setOracleManager(newOracleManager)).to.not.be
        .reverted;
    });

    it("should emit OracleManagerSet when the oracle manager is set", async function () {
      await expect(router.setOracleManager(newOracleManager))
        .to.emit(router, "OracleManagerSet")
        .withArgs(owner.address, newOracleManager);
    });

    it("should not allow the owner to set the oracle manager to the zero address", async function () {
      await expect(router.setOracleManager(ethers.constants.AddressZero)).to.be
        .reverted;
    });

    it("should not allow a non-owner to set the oracle manager", async function () {
      await expect(router.connect(outsider).setOracleManager(newOracleManager))
        .to.be.reverted;
    });
  });

  describe("#setTreasury", function () {
    const newTreasury = "0x0101010101010101010101010101010101010101";

    it("should allow the owner to set the treasury to a non-zero address", async function () {
      await expect(router.setTreasury(newTreasury)).to.not.be.reverted;
    });

    it("should emit TreasurySet when the treasury is set", async function () {
      await expect(router.setTreasury(newTreasury))
        .to.emit(router, "TreasurySet")
        .withArgs(owner.address, newTreasury);
    });

    it("should not allow the owner to set the treasury to the zero address", async function () {
      await expect(router.setTreasury(ethers.constants.AddressZero)).to.be
        .reverted;
    });

    it("should not allow a non-owner to set the treasury", async function () {
      await expect(router.connect(outsider).setTreasury(newTreasury)).to.be
        .reverted;
    });
  });

  describe("#pause", function () {
    it("should allow the owner to pause the contract", async function () {
      await expect(router.pause()).to.not.be.reverted;

      expect(await router.paused()).to.be.true;
    });

    it("should emit Paused when the contract is paused", async function () {
      await expect(router.pause())
        .to.emit(router, "Paused")
        .withArgs(owner.address);
    });

    it("should not allow a non-owner to pause the contract", async function () {
      await expect(router.connect(outsider).pause()).to.be.reverted;
    });
  });

  describe("#unpause", function () {
    it("should not allow a non-owner to unpause the contract", async function () {
      await router.pause();
      await expect(router.connect(outsider).unpause()).to.be.reverted;
    });

    it("should allow the owner to unpause the contract", async function () {
      await router.pause();
      await expect(router.unpause()).to.not.be.reverted;

      expect(await router.paused()).to.be.false;
    });
  });
});
