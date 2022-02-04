const {getAavePositions, parseAavePositions, getPositionDataOnchain} = require('../utils/aaveUtils');
const fs = require(`fs`).promises;
const {web3} = require('@openzeppelin/test-helpers/src/setup');
const BN = require('bn.js');
const {pos} = require("truffle/build/356.bundled");

module.exports = {
	name: `--getFilteredAavePositions`,
	async run(args) {
		try {
			const [version, network, configFilePath] = args;

			const configFileContent = await fs.readFile(configFilePath);
			config = JSON.parse(configFileContent);
			console.log(`###: config`, config);

			const positions = await getAavePositions(version, network);
			const parsedAavePositions = await parseAavePositions(positions);
			const maxHealthFactor = config.maxHealthFactor ? web3.utils.toWei(config.maxHealthFactor, 'ether') : web3.utils.toWei('1.0', 'ether');

			const filteredAavePositions = parsedAavePositions.filter(position => {
				if (position.healthFactor.eq(new BN(0))) {
					return false;
				}
				return new BN(maxHealthFactor).gt(position.healthFactor);
			}).sort((a,b) => a.maxBorrowedETH.lt(b.maxBorrowedETH) ? 1 : -1);

			const onChainPositionsPromises = filteredAavePositions.map(async (position) => await getPositionDataOnchain(network, position));
			const onChainAdjustedPositions =  await Promise.all(onChainPositionsPromises);

			const filteredAndOnChainAdjustedPositions = onChainAdjustedPositions.filter(position => new BN(maxHealthFactor).gt(position.healthFactor));

			console.log(`###: filteredAndOnChainAdjustedPositions`, filteredAndOnChainAdjustedPositions.sort((a,b) => a.liquidationBonusETH.lt(b.liquidationBonusETH) ? 1 : -1).map(position => ({
				userAddress: position.userAddress,
				healthFactor: web3.utils.fromWei(position.healthFactor.toString(), 'ether'),
				debtToCover: position.debtToCover.toString(),
				debtTokenAddress: position.debtTokenAddress,
				debtTokenDecimals: position.debtTokenDecimals,
				collateralAmount: position.collateralAmount.toString(),
				collateralTokenAddress: position.collateralTokenAddress,
				collateralTokenDecimals: position.collateralTokenDecimals,
				collateralBonus: position.collateralBonus,
				liquidationBonus: position.liquidationBonus.toString(),
				liquidationBonusETH: position.liquidationBonusETH.toString(),
				collateralTokenSymbol: position.collateralTokenSymbol,
				debtTokenSymbol: position.debtTokenSymbol,
			})));
		} catch (err) {
			console.log(`###: err`, err);
		}
	}
};
