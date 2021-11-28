// Traditional Truffle test
const { ether, expectRevert, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockAggregator = artifacts.require('MockAggregator');
const TokenMock = artifacts.require('TokenMock');
const IWETH = artifacts.require('IWETH');

const ILimitOrderProtocol = artifacts.require('ILimitOrderProtocol');

const Liquidator = artifacts.require('Liquidator');

const LendingPoolAddressesProvider = require("@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json");
const LendingPool = require("@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json");
const AaveOracle = require("@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json");

const { buildOrderData, ABIOrder } = require('./helpers/orderUtils');
const { cutLastArg, toBN } = require('./helpers/utils');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

contract('Inchi', async function ([_, wallet]) {
  const aaveLendingPoolAddressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
  const aaveOracle = '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9';
  const aaveOracleOwner = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';
  const limitOrderProtocol = '0x3ef51736315F52d568D6D2cf289419b9CfffE782';

  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const WAD = toBN(10).pow(toBN(18));

  const ASSET_ADDRESSES = {
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    GUSD: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  };

  function buildOrder (
      exchange,
      makerAsset,
      takerAsset,
      makerAmount,
      takerAmount,
      maker = zeroAddress,
      taker = zeroAddress,
      predicate = '0x',
      permit = '0x',
      interaction = '0x',
  ) {
    return buildOrderWithSalt(
        exchange,
        '1',
        makerAsset,
        takerAsset,
        makerAmount,
        takerAmount,
        maker,
        taker,
        predicate,
        permit,
        interaction,
    );
  }

  function buildOrderWithSalt (
      exchange,
      salt,
      makerAsset,
      takerAsset,
      makerAmount,
      takerAmount,
      maker = zeroAddress,
      taker = zeroAddress,
      predicate = '0x',
      permit = '0x',
      interaction = '0x',
  ) {
    return {
      salt: salt,
      makerAsset: makerAsset.address,
      takerAsset: takerAsset.address,
      makerAssetData: makerAsset.contract.methods
          .transferFrom(maker, taker, makerAmount)
          .encodeABI(),
      takerAssetData: takerAsset.contract.methods
          .transferFrom(taker, maker, takerAmount)
          .encodeABI(),
      getMakerAmount: cutLastArg(
          exchange.contract.methods
              .getMakerAmount(makerAmount, takerAmount, 0)
              .encodeABI(),
      ),
      getTakerAmount: cutLastArg(
          exchange.contract.methods
              .getTakerAmount(makerAmount, takerAmount, 0)
              .encodeABI(),
      ),
      predicate: predicate,
      permit: permit,
      interaction: interaction,
    };
  }

  beforeEach(async function () {
    this.swap = await ILimitOrderProtocol.at(limitOrderProtocol);

    this.liquidator = await Liquidator.new(this.swap.address, aaveLendingPoolAddressProvider);
    this.MockAggregator = await MockAggregator.new('10000');

    this.lendingPoolAddressProvider = new web3.eth.Contract(LendingPoolAddressesProvider.abi, aaveLendingPoolAddressProvider);
    const lendingPoolAddress = await this.lendingPoolAddressProvider.methods.getLendingPool().call();
    this.lendingPool = new web3.eth.Contract(LendingPool.abi, lendingPoolAddress);
    this.aaveOracle = new web3.eth.Contract(AaveOracle.abi, aaveOracle);

    this.weth = await IWETH.at(ASSET_ADDRESSES.WETH);
    console.log(`###: this.weth.contract.methods`, this.weth.contract.methods);
    this.dai = await TokenMock.at(ASSET_ADDRESSES.DAI);

    this.usdc = await TokenMock.new('USDC', 'USDC');

    // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
    // from within the EVM as from the JSON RPC interface.
    // See https://github.com/trufflesuite/ganache-core/issues/515
    this.chainId = await this.usdc.getChainId()
  });

  describe('Liquidator', function () {
    it('should liquidate unhealthy position on order fill', async function() {
      // // deposit 2 WETH to Aaave
      // await this.weth.deposit({from: wallet, value: ether('2')});
      // await this.weth.approve(this.lendingPool._address, ether('2'), {from: wallet});
      // await this.lendingPool.methods.deposit(ASSET_ADDRESSES.WETH, ether('2'), wallet, 0).send({from: wallet});
      //
      // // borrow maximum available amount of DAI
      // const userData = await this.lendingPool.methods.getUserAccountData(wallet).call();
      // const assetPriceInEth = await this.aaveOracle.methods.getAssetPrice(this.dai.address).call();
      // const maxBorrow = (new BN(userData.availableBorrowsETH)).mul(WAD).div((new BN(assetPriceInEth)));
      // await this.lendingPool.methods.borrow(this.dai.address, maxBorrow, 2, 0, wallet).send({from: wallet});
      //
      // // replace Aave Oracle with MockAggregator and increase DAI price to make the loan unhealthy
      // const newAssetPriceInEth = (new BN(assetPriceInEth)).mul(toBN(2));
      // await this.MockAggregator.setLatestAnswer(newAssetPriceInEth);
      // await web3.eth.sendTransaction({to: aaveOracleOwner, from: wallet, value: ether('5')});
      //
      // try {
      //  await this.aaveOracle.methods.setAssetSources([this.dai.address], [this.MockAggregator.address]).send({from: aaveOracleOwner});
      // } catch(e) {
      //   console.log(e);
      // }
      // const userDataAfterPriceChanged = await this.liquidator.getUserAccountData(wallet);
      // const healthFactorAfterPriceChanged = await this.liquidator.getHealthFactor(wallet);
      //
      // console.log(`###: healthFactorAfterPriceChanged`, web3.utils.fromWei(healthFactorAfterPriceChanged, 'ether'))
      //
      // // create 1inch limit order that will liquidate this loan on fill
      // // makerAmount = 50% of collateral
      // // takerAmount = 50% of debt
      // // predicate = health factor below 1
      // // signature = order itself, isValidSignature will check if hash(order params in signature) is the same as order hash
      // const walletDAIBalance = await this.dai.balanceOf(wallet);
      // const purchaseAmount = toBN(walletDAIBalance).divn(2);
      // const collateralAmount = toBN(userDataAfterPriceChanged.totalCollateralETH).divn(2);
      //
      // const hfCall = this.liquidator.contract.methods.getHealthFactor(wallet).encodeABI();
      // const predicate = this.swap.contract.methods.lt(ether('1'), this.liquidator.address, hfCall).encodeABI();
      // // TODO: implement getTakerAmount and getMakerAmount to get debtToCover on fill including interest
      // const order = buildOrder(this.swap, this.weth, this.dai, collateralAmount, purchaseAmount, this.liquidator.address, zeroAddress, predicate);
      // order.interaction = web3.eth.abi.encodeParameters(['address', 'address', 'address', 'uint256', 'bool'], [this.weth.address, this.dai.address, wallet, purchaseAmount, false]);
      //
      // // const data = buildOrderData(this.chainId, this.swap.address, order);
      // // const orderHash = bufferToHex(ethSigUtil.TypedDataUtils.sign(data));
      // const signature = web3.eth.abi.encodeParameter(ABIOrder, order);
      //
      // //approve takerAmount by taker
      // await this.dai.methods.approve(this.swap.address, purchaseAmount).send({from: wallet});
      // try {
      //   // fill order
      //   const receipt = await this.swap.fillOrder(order, signature, collateralAmount, 0, purchaseAmount, {from: wallet});
      // } catch (e) {
      //   console.log(e);
      // }
      //
      // const healthFactorAfterLiquidation = await this.liquidator.getHealthFactor(wallet);
      // console.log('Position has been successfully liquidated, new health factor is: ', web3.utils.fromWei(healthFactorAfterLiquidation, 'ether'));
      //
      // return true;
    });

  });
});
