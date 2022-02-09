require('@nomiclabs/hardhat-truffle5');
require('solidity-coverage');
require('hardhat-deploy');
require('hardhat-gas-reporter');
require('dotenv').config();
const networks = require('./hardhat.networks');

networks.hardhat = {
	forking: {
		url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_API_KEY}`
	},
}

module.exports = {
	solidity: {
		compilers: [
			{
				version: '0.8.11',
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000,
					},
				},
			},
		],
	},
	gasReporter: {
		enable: true,
		currency: 'USD',
	},
	networks: networks,
	namedAccounts: {
		deployer: {
			default: 0,
		},
	},
	paths: {
		tests: './hardhat_tests',
		sources: './contracts/**',
		artifacts: './artifacts',
	},
	mocha: {
		timeout: 200000,
	},
};
