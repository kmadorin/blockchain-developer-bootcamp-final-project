const hre = require('hardhat');
const { getChainId } = hre;

module.exports = async ({ getNamedAccounts, deployments }) => {
	const network = hre.network.name;

	const CONTRACTS_ADDRESSES = {
		mainnet: {
			aaveProtocolDataProviderAddress: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
			aaveLendingPoolAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
			aaveOracle: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
			aaveOracleOwner: '0xee56e2b3d491590b5b31738cc34d5232f378a8d5',
			limitOrderProtocolAddress: '0xb707d89D29c189421163515c59E42147371D6857',
			limitOrderProtocolAddressV2: '0x119c71D3BbAC22029622cbaEc24854d3D32D2828',
		},
		polygon: {
			aaveProtocolDataProviderAddress: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
			aaveLendingPoolAddressProvider: '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
			aaveOracle: '0x0229f777b0fab107f9591a41d5f02e4e98db6f2d',
			aaveOracleOwner: '0xdc9A35B16DB4e126cFeDC41322b3a36454B1F772',
			limitOrderProtocolAddress: '0x3ef51736315F52d568D6D2cf289419b9CfffE782',
			limitOrderProtocolAddressV2: '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f',
		},
		kovan: {
			aaveProtocolDataProviderAddress: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
			aaveLendingPoolAddressProvider: '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
			aaveOracle: '0x0229f777b0fab107f9591a41d5f02e4e98db6f2d',
			aaveOracleOwner: '0xdc9A35B16DB4e126cFeDC41322b3a36454B1F772',
			limitOrderProtocolAddress: '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f',
			limitOrderProtocolAddressV2: '0x94Bc2a1C732BcAd7343B25af48385Fe76E08734f',
		}
	}

	console.log('running deploy script');
	console.log('network id ', await getChainId());

	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	try {
		const liquidator = await deploy('Liquidator', {
			from: deployer,
			args: [CONTRACTS_ADDRESSES[network].limitOrderProtocolAddressV2, CONTRACTS_ADDRESSES[network].aaveLendingPoolAddressProvider, CONTRACTS_ADDRESSES[network].aaveOracle]
		});

		console.log('Liquidator deployed to:', liquidator.address);

		if (await getChainId() !== '31337') {
			await hre.run('verify:verify', {
				address: liquidator.address,
			});
		}

	} catch(e) {
		console.log(`###: e`, e);
	}


};

// module.exports.skip = async () => true;
