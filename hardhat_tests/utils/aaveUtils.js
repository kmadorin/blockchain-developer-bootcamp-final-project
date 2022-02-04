const {ChainId} = require('@uniswap/sdk');
const {formatUserSummaryData} = require('@aave/protocol-js');
require('isomorphic-fetch');
const {TOKEN_LIST, APP_CHAIN_ID} = require('../constants');


const BN = require('bn.js');

const theGraphURL_v2_kovan = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2-kovan'
const theGraphURL_v2_mainnet = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2'
const theGraphURL_v2_matic = 'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic'
const theGraphUniswapURL_v2_mainnet = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
// const theGraphURL_v2 = APP_CHAIN_ID == ChainId.MAINNET ? theGraphURL_v2_mainnet : theGraphURL_v2_kovan
const theGraphURL_v2 = theGraphURL_v2_matic;
const theGraphUniswapURL_v2 = theGraphUniswapURL_v2_mainnet;

const allowedLiquidation = .5 //50% of a borrowed asset can be liquidated
const healthFactorMax = 1 //liquidation can happen when less than 1
const profit_threshold = .001 * (10 ** 18) //in eth. A bonus below this will be ignored


function parseUsers(payload) {
	var loans = [];
	payload.users.forEach((user, i) => {
		var totalBorrowed = 0;
		var totalBorrowedBN = new BN(0);
		var totalCollateral = 0;
		var totalCollateralThreshold = 0;
		var max_borrowedSymbol;
		var max_collateralAmount = 0;
		var max_borrowedPrincipal = 0;
		var max_borrowedPriceInEth = 0;
		var max_collateralSymbol;
		var max_collateralReserve;
		var max_borrowReserve;
		var max_collateralBonus = 0;
		var max_collateralBonusETH = new BN(0);
		var max_collateralPriceInEth = 0;

		user.borrowReserve.forEach((borrowReserve, i) => {
			var priceInEth = borrowReserve.reserve.price.priceInEth
			var principalBorrowed = borrowReserve.currentTotalDebt
			totalBorrowed += priceInEth * principalBorrowed / (10 ** borrowReserve.reserve.decimals)

			if (principalBorrowed > max_borrowedPrincipal) {
				max_borrowedSymbol = borrowReserve.reserve.symbol
				max_borrowReserve = borrowReserve
				max_borrowedPrincipal = principalBorrowed
				max_borrowedPriceInEth = priceInEth
			}
		});
		user.collateralReserve.forEach((collateralReserve, i) => {
			var priceInEth = collateralReserve.reserve.price.priceInEth
			var principalATokenBalance = collateralReserve.currentATokenBalance;
			const collateralAmountETH = new BN(priceInEth).mul(new BN(principalATokenBalance)).div(new BN(10).pow(new BN(collateralReserve.reserve.decimals)));
			const collateralBonusETH = collateralAmountETH.muln(+collateralReserve.reserve.reserveLiquidationBonus-10000).divn(10000);
			totalCollateral += priceInEth * principalATokenBalance / (10 ** collateralReserve.reserve.decimals);
			totalCollateralThreshold += priceInEth * principalATokenBalance * (collateralReserve.reserve.reserveLiquidationThreshold / 10000) / (10 ** collateralReserve.reserve.decimals)

			if (collateralBonusETH.gt(max_collateralBonusETH)) {
				max_collateralSymbol = collateralReserve.reserve.symbol
				max_collateralReserve = collateralReserve
				max_collateralAmount = collateralReserve.currentATokenBalance
				max_collateralBonusETH = collateralBonusETH;
				max_collateralBonus = collateralReserve.reserve.reserveLiquidationBonus
				max_collateralPriceInEth = priceInEth
			}
		});
		var healthFactor = totalCollateralThreshold / totalBorrowed;

		if (healthFactor <= healthFactorMax && healthFactor !== 0) {
			loans.push({
				"user_id": user.id,
				"healthFactor": healthFactor,
				"max_collateralSymbol": max_collateralSymbol,
				"max_collateralAmount": max_collateralAmount,
				"max_borrowedSymbol": max_borrowedSymbol,
				"max_borrowedPrincipal": max_borrowedPrincipal,
				"max_borrowedPriceInEth": max_borrowedPriceInEth,
				"max_collateralBonus": max_collateralBonus,
				"max_collateralPriceInEth": max_collateralPriceInEth,
				"totalCollateral": totalCollateral,
				"totalCollateralThreshold": totalCollateralThreshold,
				"totalBorrowed": totalBorrowed,
				"max_collateralReserve": max_collateralReserve,
				"max_borrowReserve": max_borrowReserve,
			})
		}
	});

	// TODO: filter by profit threshold
	//filter out loans under a threshold that we know will not be profitable (liquidation_threshold)
	loans = loans.filter(loan => {
		if (!loan.max_collateralSymbol && !loan.max_collateralReserve) return false;
		if (!TOKEN_LIST[loan.max_borrowedSymbol]) {
			// console.log(`###: loan`, loan);

			console.log('Token is not in TokenList. Please add it to constants.')
			console.log(`###: Token symbol`, loan.max_collateralSymbol);
			console.log(`###: Token address `, loan.max_collateralReserve.reserve.underlyingAsset);
			console.log(`###: Token decimals `, loan.max_collateralReserve.reserve.decimals);

			return false;
		}

		return loan.max_borrowedPrincipal * allowedLiquidation * (loan.max_collateralBonus - 1) * loan.max_borrowedPriceInEth / 10 ** TOKEN_LIST[loan.max_borrowedSymbol].decimals >= profit_threshold
		// return loan.max_collateralAmount * allowedLiquidation * (loan.max_collateralBonus/10000 - 1) * loan.max_collateralPriceInEth / 10 ** TOKEN_LIST[loan.max_collateralSymbol].decimals >= profit_threshold
	})

	return loans;
}

async function fetchV2UnhealthyLoans() {
	let count = 0;
	const maxCount = 6;

	let fetchLoansChunksPromisesArray = [];

	while (count < maxCount) {
		const fetchPromise = new Promise((resolve, reject) => {
			fetch(theGraphURL_v2, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					query: `
      query GET_LOANS {
        users(first:1000, skip:${1000 * count}, orderBy: id, orderDirection: desc, where: {borrowedReservesCount_gt: 0}) {
          id
          borrowedReservesCount
          collateralReserve:reserves(where: {currentATokenBalance_gt: 0}) {
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
          borrowReserve: reserves(where: {currentTotalDebt_gt: 0}) {
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
				// console.log(`###: res.data`, res.data);
				// resolve([])
				const unhealthyLoansChunk = parseUsers(res.data);
				resolve(unhealthyLoansChunk);
			}).catch(e => reject(e))
		});

		fetchLoansChunksPromisesArray.push(fetchPromise);

		count++;
	}

	const positionsChunks = await Promise.all(fetchLoansChunksPromisesArray);
	const positions = positionsChunks.reduce((prev, cur) => prev.concat(cur), []);
	// console.log(`###: positions`, positions.length);
	// return []
	return positions.map(position => {
		return {
			userAddress: position.user_id,
			healthFactor: position.healthFactor,
			maxCollateralSymbol: position.max_collateralSymbol,
			maxBorrowSymbol: position.max_borrowedSymbol,
			maxBorrowAmount: position.max_borrowedPrincipal,
			maxCollateralAmount: position.max_collateralReserve.currentATokenBalance,
			maxCollateralBonus: position.max_collateralBonus,
			maxCollateralReserve: position.max_collateralReserve.reserve,
			maxBorrowReserve: position.max_borrowReserve.reserve,
			maxCollateralTokenAddress: position.max_collateralReserve.reserve.underlyingAsset,
			maxBorrowTokenAddress: position.max_borrowReserve.reserve.underlyingAsset,
		}
	});
}

const getUserReservesData = async (user, userReserves) => {
	return await fetch(theGraphURL_v2, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			query: `query{
    userReserves (where: { user: "${user.toLowerCase()}"}){
      scaledATokenBalance
      reserve {
        id
        underlyingAsset
        name
        symbol
        decimals
        liquidityRate
        reserveLiquidationBonus
        lastUpdateTimestamp
      }
      usageAsCollateralEnabledOnUser
      stableBorrowRate
      stableBorrowLastUpdateTimestamp
      principalStableDebt
      scaledVariableDebt
      variableBorrowIndex
      aTokenincentivesUserIndex
      vTokenincentivesUserIndex
      sTokenincentivesUserIndex
    }
  }`
		}),
	}).then(res => res.json()).then(res => res.data.userReserves);
}

const getRawReservesData = async function () {
	return await fetch(theGraphURL_v2, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			query: `query{
    reserves {
      id
      underlyingAsset
      name
      symbol
      decimals
      isActive
      isFrozen
      usageAsCollateralEnabled
      borrowingEnabled
      stableBorrowRateEnabled
      baseLTVasCollateral
      optimalUtilisationRate
      averageStableRate
      stableRateSlope1
      stableRateSlope2
      baseVariableBorrowRate
      variableRateSlope1
      variableRateSlope2
      liquidityIndex
      reserveLiquidationThreshold
      variableBorrowIndex
      aToken {
        id
      }
      vToken {
        id
      }
      sToken {
        id
      }
      availableLiquidity
      stableBorrowRate
      liquidityRate
      totalPrincipalStableDebt
      totalScaledVariableDebt
      reserveLiquidationBonus
      variableBorrowRate
      price {
        priceInEth
      }
      lastUpdateTimestamp
      stableDebtLastUpdateTimestamp
      reserveFactor
      aEmissionPerSecond
      vEmissionPerSecond
      sEmissionPerSecond
      aTokenIncentivesIndex
      vTokenIncentivesIndex
      sTokenIncentivesIndex
      aIncentivesLastUpdateTimestamp
      vIncentivesLastUpdateTimestamp
      sIncentivesLastUpdateTimestamp
    }
  }`
		}),
	}).then(res => res.json()).then(res => res.data.reserves);
}

const getUserSummary = async function (user, rawReservesData, rawUserReservesData) {
	const ethPrice = await fetch(theGraphUniswapURL_v2, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			query: `
      query GET_ETH_USD_PRICE {
        bundle(id: 1) { id ethPrice }
      }`
		}),
	}).then(res => res.json()).then(res => res.data.bundle.ethPrice);


	return formatUserSummaryData(
		rawReservesData,
		rawUserReservesData,
		user,
		ethPrice,
		Math.round(new Date().getTime() / 1000),
	);
}

module.exports = {
	fetchV2UnhealthyLoans,
	getUserSummary,
	getUserReservesData,
	getRawReservesData
}
