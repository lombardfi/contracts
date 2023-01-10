import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ContractFactory } from "ethers";
import { getBlockTimestamp } from "../helpers/helpers";
import { coupon, ltv, FUNDING_PORTION } from "../helpers/constants";
import { TestERC20, PoolFactory, Router, DeflationaryERC20 } from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setNextBlockTimestamp } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
const { loadFixture } = waffle;

const minSupply = ethers.utils.parseEther("10");
const maxSupply = ethers.utils.parseEther("100");

const activeAt = 3000000000;
const maturesAt = 4000000000;

const upfrontSize = maxSupply.mul(coupon).div(ethers.utils.parseEther("1"));

let owner: SignerWithAddress,
  requester: SignerWithAddress,
  router: Router,
  tokenA: TestERC20,
  tokenB: TestERC20,
  tokenC: TestERC20,
  tokenD: TestERC20,
  tokenE: TestERC20,
  tokenF: TestERC20,
  token19: TestERC20,
  poolFactory: PoolFactory,
  PoolFactoryFactory: ContractFactory;

describe("Pool Factory", function () {
  async function fixture() {
    [owner, requester] = await ethers.getSigners();

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
    token19 = (await TestERC20Factory.deploy()) as TestERC20;

    await token19.overrideDecimals(19);

    PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = (await PoolFactoryFactory.deploy(
      router.address
    )) as PoolFactory;

    await router.setFactory(poolFactory.address);

    await router.setTreasury(owner.address);

    await tokenB.mint(upfrontSize); // mint 1000 tokenB to owner in order to fund pool creation
    await tokenB.approve(poolFactory.address, upfrontSize);
  }

  beforeEach(async function () {
    await loadFixture(fixture);
  });

  describe("#constructor", function () {
    it("should fail if the supplied router address is the zero address", async function () {
      await expect(PoolFactoryFactory.deploy(ethers.constants.AddressZero)).to
        .be.reverted;
    });
    it("should deploy if the supplied router address is non-zero", async function () {
      await expect(
        PoolFactoryFactory.deploy("0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa")
      ).to.not.be.reverted;
    });

    it("should deploy and correctly set the owner and the router", async function () {
      const routerAddress = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
      const deployedFactory = (await PoolFactoryFactory.deploy(
        routerAddress
      )) as PoolFactory;

      expect(await deployedFactory.router()).to.equal(routerAddress);
      expect(await deployedFactory.owner()).to.equal(owner.address);
    });
  });

  describe("#createPool", function () {
    context("when validating caller", function () {
      it("should allow the owner to create a pool, emit PoolCreated, derive additional parameters and update storage", async function () {
        const mintAmount = ethers.utils.parseEther("1000000000000000");
        await tokenB.mint(mintAmount);
        await tokenB.approve(poolFactory.address, mintAmount);

        const startsAt = (await getBlockTimestamp()) + 1000;
        await setNextBlockTimestamp(startsAt);

        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        )
          .to.emit(poolFactory, "PoolCreated")
          .withArgs(1, [tokenA.address], tokenB.address, upfrontSize);

        const poolAddress = await poolFactory.pidToPoolAddress(0);
        const PoolFactory = await ethers.getContractFactory("Pool");
        const pool = PoolFactory.attach(poolAddress);

        const transferredUpfrontCoupon = await tokenB.balanceOf(pool.address);
        const expectedUpfrontCoupon = maxSupply
          .mul(coupon)
          .div(ethers.utils.parseEther("1"));

        expect(await poolFactory.pid()).to.eq(1);

        expect(await poolFactory.pidToPoolAddress(0)).to.not.eq(
          ethers.constants.AddressZero
        );

        expect(await pool.borrower()).to.eq(owner.address);
        expect(await pool.whitelistedLender()).to.eq(
          ethers.constants.AddressZero
        );
        expect(await pool.lentAsset()).to.eq(tokenB.address);

        expect(await pool.startsAt()).to.eq(startsAt);
        expect(await pool.activeAt()).to.eq(activeAt);
        expect(await pool.maturesAt()).to.eq(maturesAt);

        expect(await pool.coupon()).to.eq(coupon);
        expect(await pool.ltv()).to.eq(ltv);
        expect(await pool.originationFee()).to.eq(
          await poolFactory.originationFee()
        );

        expect(await pool.leftoversWithdrawn()).to.be.false;

        expect(await pool.minSupply()).to.eq(minSupply);
        expect(await pool.maxSupply()).to.eq(maxSupply);
        expect(await pool.supply()).to.eq(0);
        expect(await pool.borrowed()).to.eq(0);

        expect(transferredUpfrontCoupon).to.eq(expectedUpfrontCoupon);
      });
    });

    context("when validating timestamps", function () {
      it("should fail if the activeAt timestamp is in the past", async function () {
        const now = await getBlockTimestamp();
        const poolActiveAt = now + 10000;
        const poolMatureAt = now + 20000;

        await setNextBlockTimestamp(activeAt);
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            poolActiveAt - 1,
            poolMatureAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid timestamps");
      });

      it("should fail if the start timestamp is after the maturesAt timestamp", async function () {
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            maturesAt + 1,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid timestamps");
      });

      it("should fail if the start timestamp is equal to the maturesAt timestamp", async function () {
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            activeAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid timestamps");
      });
    });

    context("when validating assets", function () {
      it("should fail if the number of collateral assets = 0", async function () {
        const mintAmount = ethers.utils.parseEther("1000000000000000");
        await tokenB.mint(mintAmount);
        await tokenB.approve(poolFactory.address, mintAmount);
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid collaterals");
      });

      it("should fail if the number of collateral assets > maximum", async function () {
        const mintAmount = ethers.utils.parseEther("1000000000000000");
        await tokenB.mint(mintAmount);
        await tokenB.approve(poolFactory.address, mintAmount);

        const collateralAssets = [
          tokenA.address,
          tokenB.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];

        expect(await poolFactory.maxNumberOfCollateralAssets()).to.be.lt(
          collateralAssets.length
        );
        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid collaterals");
      });

      it("should not fail if the number of collateral assets = maximum", async function () {
        const mintAmount = ethers.utils.parseEther("1000000000000000");
        await tokenB.mint(mintAmount);
        await tokenB.approve(poolFactory.address, mintAmount);

        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        expect(await poolFactory.maxNumberOfCollateralAssets()).to.be.eq(
          collateralAssets.length
        );

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.not.be.reverted;
      });

      it("should fail if the collateral assets contain the zero address (in the beginning)", async function () {
        const collateralAssets = [
          ethers.constants.AddressZero,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the collateral assets contain the zero address (in the middle)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          ethers.constants.AddressZero,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the collateral assets contain the zero address (at the end)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          ethers.constants.AddressZero,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the collateral assets contain a duplicate (in the beginning)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenA.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the collateral assets contain a duplicate (in the middle)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenC.address,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the collateral assets contain a duplicate (at the end)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenC.address,
          tokenE.address,
          tokenE.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if a collateral asset has more than 18 decimals (in the beginning)", async function () {
        const collateralAssets = [
          token19.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if a collateral asset has more than 18 decimals (in the middle)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          token19.address,
          tokenE.address,
          tokenF.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if a collateral asset has more than 18 decimals (at the end)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          token19.address,
        ];

        await expect(
          poolFactory.createPool(
            tokenB.address,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the lent asset is the zero address", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        const lentAsset = ethers.constants.AddressZero;

        await expect(
          poolFactory.createPool(
            lentAsset,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the lent asset is a duplicate of a collateral asset (in the beginning)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        const lentAsset = collateralAssets[0];

        await expect(
          poolFactory.createPool(
            lentAsset,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the lent asset is a duplicate of a collateral asset (in the middle)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        const lentAsset = collateralAssets[2];

        await expect(
          poolFactory.createPool(
            lentAsset,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the lent asset is a duplicate of a collateral asset (at the end)", async function () {
        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        const lentAsset = collateralAssets[4];

        await expect(
          poolFactory.createPool(
            lentAsset,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });

      it("should fail if the lent asset has more than 18 decimals", async function () {
        await token19.mint(FUNDING_PORTION.mul(10));
        await token19.approve(poolFactory.address, FUNDING_PORTION.mul(10));

        const collateralAssets = [
          tokenA.address,
          tokenC.address,
          tokenD.address,
          tokenE.address,
          tokenF.address,
        ];
        const lentAsset = token19.address;

        await expect(
          poolFactory.createPool(
            lentAsset,
            collateralAssets,
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid assets");
      });
    });

    context("when validating supply range", function () {
      it("should fail if the minimum supply > maximum supply", async function () {
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            2,
            1,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid supply range");
      });

      it("should fail if the minimum supply = 0", async function () {
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            0,
            1,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("Factory::invalid supply range");
      });

      it("should not fail if the minimum supply = maximum supply", async function () {
        await expect(
          poolFactory.createPool(
            tokenB.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            1,
            1,
            ethers.constants.AddressZero
          )
        ).to.not.be.reverted;
      });

      it("should fail if the transferred rewards are less than the calculated", async function () {
        const outsider = requester;
        const DeflationaryERC20Factory = await ethers.getContractFactory("DeflationaryERC20");
        const deflToken = (await DeflationaryERC20Factory.deploy(outsider.address)) as DeflationaryERC20;

        await deflToken.setTaxRate(10);

        await deflToken.mint(upfrontSize);
        await deflToken.approve(poolFactory.address, upfrontSize);

        await expect(
          poolFactory.createPool(
            deflToken.address,
            [tokenA.address],
            coupon,
            ltv,
            activeAt,
            maturesAt,
            minSupply,
            maxSupply,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith(
          "Factory::rewards discrepancy"
        );
      });
    });
  });

  describe("#setMaxNumberOfCollateralAssets", function () {
    it("should correctly set the new value", async function () {
      await poolFactory.setMaxNumberOfCollateralAssets(42);

      expect(await poolFactory.maxNumberOfCollateralAssets()).to.equal(42);
    });

    it("should emit ParametersChanged when a new value is set", async function () {
      const originationFee = await poolFactory.originationFee();
      await expect(poolFactory.setMaxNumberOfCollateralAssets(42))
        .to.emit(poolFactory, "ParametersChanged")
        .withArgs(42, originationFee);
    });

    it("should fail if the new value = 0", async function () {
      await expect(poolFactory.setMaxNumberOfCollateralAssets(0)).to.be
        .reverted;
    });

    it("should fail if the caller is not the owner", async function () {
      await expect(
        poolFactory.connect(requester).setMaxNumberOfCollateralAssets(0)
      ).to.be.reverted;
    });
  });

  describe("#setOriginationFee", function () {
    it("should correctly set the new value", async function () {
      await poolFactory.setOriginationFee(42);

      expect(await poolFactory.originationFee()).to.equal(42);
    });

    it("should emit ParametersChanged when a new value is set", async function () {
      const maxNumberOfCollateralAssets =
        await poolFactory.maxNumberOfCollateralAssets();

      await expect(poolFactory.setOriginationFee(42))
        .to.emit(poolFactory, "ParametersChanged")
        .withArgs(maxNumberOfCollateralAssets, 42);
    });

    it("should not fail if the new value = 0", async function () {
      await expect(poolFactory.setOriginationFee(0)).to.not.be.reverted;
    });

    it("should fail if the caller is not the owner", async function () {
      await expect(poolFactory.connect(requester).setOriginationFee(42)).to.be
        .reverted;
    });

    it("should fail if the caller is not the owner", async function () {
      const maxOriginationFee = await poolFactory.MAX_ORIGINATION_FEE();

      await expect(poolFactory.setOriginationFee(maxOriginationFee.add(1))).to
        .be.reverted;
    });
  });

  describe("#getAllPools", function () {
    it("should correctly return all deployed pools", async function () {
      const mintAmount = ethers.utils.parseEther("1000000000000000");
      await tokenB.mint(mintAmount);
      await tokenB.approve(poolFactory.address, mintAmount);

      const startsAt = (await getBlockTimestamp()) + 1000;
      await setNextBlockTimestamp(startsAt);

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      const pool0 = await poolFactory.pidToPoolAddress(0);
      const pool1 = await poolFactory.pidToPoolAddress(1);
      const pool2 = await poolFactory.pidToPoolAddress(2);

      const allPools = await poolFactory.getAllPools();

      expect(allPools).to.have.length(3);
      expect(allPools[0]).to.equal(pool0);
      expect(allPools[1]).to.equal(pool1);
      expect(allPools[2]).to.equal(pool2);
    });

    it("should return an empty array if there are no pools", async function () {
      const newPoolFactory = (await PoolFactoryFactory.deploy(
        router.address
      )) as PoolFactory;

      expect(await newPoolFactory.getAllPools()).to.be.empty;
    })
  });
  describe("#getAllPoolsSlice", function () {
    it("should correctly return a slice of all deployed pools", async function () {
      const mintAmount = ethers.utils.parseEther("1000000000000000");
      await tokenB.mint(mintAmount);
      await tokenB.approve(poolFactory.address, mintAmount);

      const startsAt = (await getBlockTimestamp()) + 1000;
      await setNextBlockTimestamp(startsAt);

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      await poolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      const pool0 = await poolFactory.pidToPoolAddress(0);
      const allPools = await poolFactory.getAllPoolsSlice(0, 1);

      expect(allPools).to.have.length(1);
      expect(allPools[0]).to.equal(pool0);
    });

    it("should return an empty array if the slice length is 0", async function () {
      expect(await poolFactory.getAllPoolsSlice(0, 0)).to.have.length(0);
    })

    it("should fail if the end of the slice is larger than the start", async function () {
      await expect(poolFactory.getAllPoolsSlice(0, 1)).to.be.reverted;
    })

    it("should fail if the slice end is larger than the pid", async function () {
      const newPoolFactory = (await PoolFactoryFactory.deploy(
        router.address
      )) as PoolFactory;

      const mintAmount = ethers.utils.parseEther("1000000000000000");
      await tokenB.mint(mintAmount);
      await tokenB.approve(newPoolFactory.address, mintAmount);

      const startsAt = (await getBlockTimestamp()) + 1000;
      await setNextBlockTimestamp(startsAt);

      await newPoolFactory.createPool(
        tokenB.address,
        [tokenA.address],
        coupon,
        ltv,
        activeAt,
        maturesAt,
        minSupply,
        maxSupply,
        ethers.constants.AddressZero
      );

      await expect(newPoolFactory.getAllPoolsSlice(0, 2)).to.be.reverted;
    })
  });
});
