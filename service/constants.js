'use strict';

module.exports.DEFAULT_COMMAND = `--help`;

module.exports.USER_ARGV_INDEX = 2;

module.exports.ExitCode = {
	error: 1,
	success: 0,
};

module.exports.THE_GRAPH_URLS = {
	aave: {
		v2: {
			mainnet: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2',
			polygon: 'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic',
		},
		v1: {
			mainnet: 'https://api.thegraph.com/subgraphs/name/aave/protocol-multy-raw'
		}
	},
	uniswap: {
		v2: {
			mainnet: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
		}
	}
}

module.exports.CONTRACTS_ADDRESSES = {
	mainnet: {
		aaveProtocolDataProviderAddress: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
		aaveLendingPoolAddressProviderAddress: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		aaveOracleAddress: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
		aaveOracleOwnerAddress: '0xee56e2b3d491590b5b31738cc34d5232f378a8d5',
		limitOrderProtocolAddress: '0xb707d89D29c189421163515c59E42147371D6857',
		limitOrderProtocolAddressV2: '0x119c71D3BbAC22029622cbaEc24854d3D32D2828',
	},
	polygon: {
		aaveProtocolDataProviderAddress: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
		aaveLendingPoolAddressProviderAddress: '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
		aaveOracleAddress: '0x0229f777b0fab107f9591a41d5f02e4e98db6f2d',
		aaveOracleOwnerAddress: '0xdc9A35B16DB4e126cFeDC41322b3a36454B1F772',
		limitOrderProtocolAddress: '0x3ef51736315F52d568D6D2cf289419b9CfffE782',
	}
}
