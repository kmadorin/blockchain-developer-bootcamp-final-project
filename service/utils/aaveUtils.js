const {THE_GRAPH_URLS, CONTRACTS_ADDRESSES} = require('../constants');
const BN = require('bn.js');
const Web3 = require("web3");
const LendingPoolAddressesProvider = require("@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json");
const LendingPool = require("@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json");
const AaveProtocolDataProvider = require("@aave/protocol-v2/artifacts/contracts/misc/AaveProtocolDataProvider.sol/AaveProtocolDataProvider.json");
const AaveOracle = require("@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json");

const {web3} = require("@openzeppelin/test-helpers/src/setup");
const path = require('path')
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

async function parseAavePositions(positions) {
	const WAD = new BN(10).pow(new BN(18));
	return positions.map(position => {

		const debtInfo = position.borrowReserves.reduce((acc, borrowReserve) => {
			const priceInEth = new BN(borrowReserve.reserve.price.priceInEth);
			const principalBorrowed = new BN(borrowReserve.currentTotalDebt);
			const principalBorrowedETH = priceInEth.mul(principalBorrowed).div(new BN(10).pow(new BN(borrowReserve.reserve.decimals)))

			acc.totalBorrowedETH = acc.totalBorrowedETH.add(principalBorrowedETH);

			if (principalBorrowedETH.gt(acc.maxBorrowedETH) || (acc.maxBorrowReserve === null)) {
				acc.maxBorrowReserve = borrowReserve;
				acc.maxBorrowedETH = principalBorrowedETH;
			}

			return acc;
		}, {
			totalBorrowedETH: new BN(0),
			maxBorrowedETH: new BN(0),
			maxBorrowReserve: null
		});

		const collateralInfo = position.collateralReserves.reduce((acc, collateralReserve) => {
			const priceInEth = new BN(collateralReserve.reserve.price.priceInEth);
			const collateralAmount = new BN(collateralReserve.currentATokenBalance);
			const collateralETH = priceInEth.mul(collateralAmount).div(new BN(10).pow(new BN(collateralReserve.reserve.decimals)));
			const collateralBonusETH = collateralETH.muln(+collateralReserve.reserve.reserveLiquidationBonus-10000).divn(10000);

			acc.totalCollateralETH = acc.totalCollateralETH.add(collateralETH);
			acc.totalCollateralThresholdETH = acc.totalCollateralThresholdETH.add(collateralETH.mul(new BN(collateralReserve.reserve.reserveLiquidationThreshold)).divn(10000));

			if ((acc.maxCollateralReserve === null) || collateralBonusETH.gt(acc.maxCollateralBonusETH)) {
				acc.maxCollateralReserve = collateralReserve;
				acc.maxCollateralBonusETH = collateralBonusETH;
				acc.maxCollateralETH = collateralETH;
			}

			return acc;
		}, {
			totalCollateralETH: new BN(0),
			totalCollateralThresholdETH: new BN(0),
			maxCollateralETH: new BN(0),
			maxCollateralBonusETH: new BN(0),
			maxCollateralReserve: null
		});

		let healthFactor = new BN(0);

		if (collateralInfo.totalCollateralThresholdETH.gt(new BN(0)) && debtInfo.totalBorrowedETH.gt(new BN(0))) {
			healthFactor = collateralInfo.totalCollateralThresholdETH.mul(WAD).div(debtInfo.totalBorrowedETH);
		}

		return {...debtInfo, ...collateralInfo, healthFactor: healthFactor, userAddress: position.id}
	});
}

async function getAavePositions(version, network) {
	let count = 0;
	const maxCount = 6;

	const THE_GRAPH_URL = THE_GRAPH_URLS['aave'][version][network];

	let fetchLoansChunksPromisesArray = [];

	while (count < maxCount) {
		const fetchPromise = new Promise((resolve, reject) => {
			fetch(THE_GRAPH_URL, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					query: `
      query GET_LOANS {
        users(first:1000, skip:${1000 * count}, orderBy: id, orderDirection: desc, where: {borrowedReservesCount_gt: 0}) {
          id
          borrowedReservesCount
          collateralReserves:reserves(where: {currentATokenBalance_gt: 0}) {
            currentATokenBalance
            reserve{
              usageAsCollateralEnabled
              reserveLiquidationThreshold
              reserveLiquidationBonus
              borrowingEnabled
              utilizationRate
              symbol
              underlyingAsset
              price {
                priceInEth
              }
              decimals
            }
          }
          borrowReserves: reserves(where: {currentTotalDebt_gt: 0}) {
            currentTotalDebt
            reserve{
              usageAsCollateralEnabled
              reserveLiquidationThreshold
              borrowingEnabled
              utilizationRate
              symbol
              underlyingAsset
              price {
                priceInEth
              }
              decimals
            }
          }
        }
      }`
				}),
			}).then(res => res.json()).then(res => {
				resolve(res.data.users);
			}).catch(e => reject(e))
		});

		fetchLoansChunksPromisesArray.push(fetchPromise);

		count++;
	}

	const positionsChunks = await Promise.all(fetchLoansChunksPromisesArray);
	return positionsChunks.reduce((prev, cur) => prev.concat(cur), []);
}

async function getPositionDataOnchain(network, position) {
	let provider = '';
	switch (network) {
		case 'polygon':
			provider = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_API_KEY}`
			break;
		case 'mainnet':
			provider = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`
			break;
		default:
			throw 'Unknown network!';
	}

	const web3 = new Web3(provider);

	const {aaveProtocolDataProviderAddress, aaveLendingPoolAddressProviderAddress, aaveOracleAddress} = CONTRACTS_ADDRESSES[network];

	const aaveProtocolDataProviderContract = await new web3.eth.Contract(AaveProtocolDataProvider.abi, aaveProtocolDataProviderAddress);
	const aaveLendingPoolAddressProvider = new web3.eth.Contract(LendingPoolAddressesProvider.abi, aaveLendingPoolAddressProviderAddress);
	const lendingPoolAddress = await aaveLendingPoolAddressProvider.methods.getLendingPool().call();

	const aaveLendingPoolContract = new web3.eth.Contract(LendingPool.abi, lendingPoolAddress);
	const aaveOracleContract = new web3.eth.Contract(AaveOracle.abi, aaveOracleAddress);
	const userData = await aaveLendingPoolContract.methods.getUserAccountData(position.userAddress).call();
	const dataCollateral = await aaveProtocolDataProviderContract.methods.getUserReserveData(position.maxCollateralReserve.reserve.underlyingAsset, position.userAddress).call();
	const dataBorrow = await aaveProtocolDataProviderContract.methods.getUserReserveData(position.maxBorrowReserve.reserve.underlyingAsset, position.userAddress).call();

	const healthFactor = new BN(userData.healthFactor);
	const maxBorrowedAmount = new BN(dataBorrow.currentStableDebt).add(new BN(dataBorrow.currentVariableDebt));
	const debtToCover = maxBorrowedAmount.divn(2);
	const collateralTokenPriceETH = new BN(await aaveOracleContract.methods.getAssetPrice(position.maxCollateralReserve.reserve.underlyingAsset).call());
	const debtTokenPriceETH = new BN(await aaveOracleContract.methods.getAssetPrice(position.maxBorrowReserve.reserve.underlyingAsset).call());

	const debtToCoverETH = debtToCover.mul(debtTokenPriceETH).div((new BN('10').pow(new BN(position.maxBorrowReserve.reserve.decimals))));
	const collateralBonus = +position.maxCollateralReserve.reserve.reserveLiquidationBonus;

	let collateralAmount = new BN(0);
	if (position.maxBorrowReserve.reserve.decimals === position.maxCollateralReserve.reserve.decimals) {
		collateralAmount = debtToCover.mul(debtTokenPriceETH).div(collateralTokenPriceETH).muln(collateralBonus).divn(10000);
	} else if (position.maxBorrowReserve.reserve.decimals < position.maxCollateralReserve.reserve.decimals) {
		collateralAmount = debtToCover.mul(debtTokenPriceETH).mul((new BN(10)).pow(new BN(position.maxCollateralReserve.reserve.decimals - position.maxBorrowReserve.reserve.decimals))).div(collateralTokenPriceETH).muln(collateralBonus).divn(10000);
	} else {
		collateralAmount = debtToCover.mul(debtTokenPriceETH).div((new BN(10)).pow(new BN(position.maxBorrowReserve.reserve.decimals - position.maxCollateralReserve.reserve.decimals))).div(collateralTokenPriceETH).muln(collateralBonus).divn(10000);

	}
	// const collateralAmount = debtToCoverETH.mul((new BN('10').pow(new BN(position.maxCollateralReserve.reserve.decimals)))).div(collateralTokenPriceETH).muln(collateralBonus).divn(10000)
	const liquidationBonus = collateralAmount.muln(collateralBonus - 10000).divn(10000);
	const liquidationBonusETH = liquidationBonus.mul(collateralTokenPriceETH).div((new BN(10).pow(new BN(position.maxCollateralReserve.reserve.decimals))));
	if (position.userAddress === '0xfbf2f53966013f4d6223abbc0b640ddb49974f10') {
		console.log(`###: collateralTokenPriceETH`, collateralTokenPriceETH.toString());
		console.log(`###: collateralAmount`, collateralAmount.toString())
		console.log(`###: liquidationBonus`, liquidationBonus.toString());
		console.log(`###: collateralBonus`, collateralBonus);
	}
	return {
		userAddress: position.userAddress,
		healthFactor,
		debtTokenSymbol: position.maxBorrowReserve.reserve.symbol,
		debtTokenAddress: position.maxBorrowReserve.reserve.underlyingAsset,
		debtTokenDecimals: position.maxBorrowReserve.reserve.decimals,
		collateralTokenAddress: position.maxCollateralReserve.reserve.underlyingAsset,
		collateralTokenSymbol: position.maxCollateralReserve.reserve.symbol,
		collateralTokenDecimals: position.maxCollateralReserve.reserve.decimals,
		debtToCover,
		collateralAmount, //doesn't include bonus
		liquidationBonus,
		liquidationBonusETH,
		collateralBonus,
	}
}

module.exports = {
	getAavePositions,
	parseAavePositions,
	getPositionDataOnchain
}
