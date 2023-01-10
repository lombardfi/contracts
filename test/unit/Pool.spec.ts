import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ContractFactory } from "ethers";
import {
  coupon,
  ltv,
  FUNDING_PORTION,
  TEN_ETHER,
  testAssetsPrices,
  originationFee,
} from ".././helpers/constants";
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

describe("Pool", function () {
  beforeEach(async function () {
    await loadFixture(fixture);
  });

  async function fixture() {
    const fakeAddress = "0x0101010101010101010101010101010101010101";

    [owner, lender1, lender2] = await ethers.getSigners();
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

    await router.setTreasury(owner.address);

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

  describe("#construction", function () {
    it("should fail if the supplied router address is 0", async function () {
      const PoolFactory = await ethers.getContractFactory("Pool");
      await expect(
        PoolFactory.deploy(ethers.constants.AddressZero)
      ).to.be.revertedWith("Pool::zero address");
    });
  });


  describe("#initialize", function () {
    it("should fail if pool was already initialized", async function () {
      await expect(
        pool.initialize(
          lender1.address,
          tokenB.address,
          [tokenA.address],
          coupon.add(1),
          ltv,
          originationFee,
          activeAt,
          maturesAt,
          minSupply,
          maxSupply,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("Pool::already initialized");
    });
  });

  describe("#deposit", function () {
    it("should fail if not called by router", async function () {
      await expect(
        pool.deposit(owner.address, 0)
      ).to.be.revertedWith("Pool::caller not router");
    });
  });

  describe("#supplyCollateral", function () {
    it("should fail if not called by router", async function () {
      await expect(
        pool.supplyCollateral(tokenB.address, 1)
      ).to.be.revertedWith("Pool::caller not router");
    });
  });

  describe("#borrow", function () {
    it("should fail if not called by router", async function () {
      await expect(pool.borrow(tokenB.address, 0)).to.be.revertedWith(
        "Pool::caller not router"
      );
    });
  });

  describe("#repay", function () {
    it("should fail if not called by router", async function () {
      await expect(pool.repay(0)).to.be.revertedWith("Pool::caller not router");
    });
  });

  describe("#redeem", function () {
    it("should fail if not called by router", async function () {
      await expect(pool.redeem(owner.address)).to.be.revertedWith(
        "Pool::caller not router"
      );
    });
  });

  describe("#_default", function () {
    it("should fail if not called by router", async function () {
      await expect(pool._default(owner.address)).to.be.revertedWith(
        "Pool::caller not router"
      );
    });
  });

  describe("#withdrawLeftovers", function () {
    it("should fail if not called by router", async function () {
      await expect(pool.withdrawLeftovers(0)).to.be.revertedWith(
        "Pool::caller not router"
      );
    });
  });
});
