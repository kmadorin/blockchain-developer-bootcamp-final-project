require('@nomiclabs/hardhat-truffle5');
require('hardhat-deploy');
require('hardhat-gas-reporter');
require('dotenv').config();

module.exports = {
	solidity: {
		compilers: [
			{
				version: '0.8.4',
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
	chainId: 1,
	networks: {
		localhost: {
			chainId: 1,
			url: 'http://localhost:8545',
			/*
			  notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
			  (you can put in a mnemonic here to set the deployer locally)
			*/
		},
		hardhat: {
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
				blockNumber: 13679712,
			},
		},
	},
	paths: {
		tests: './hardhat_tests',
		sources: './contracts',
		artifacts: './artifacts',
	},
	mocha: {
		timeout: 200000,
	},
};
