const dotenv = require("dotenv");
dotenv.config();

const HDWalletProvider = require('@truffle/hdwallet-provider');
const mnemonic = process.env.MNEMONIC;

module.exports = {
	networks: {
		development: {
			skipDryRun: true,
			host: "127.0.0.1",
			port: 8545,
			fork: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
			network_id: "*",
			provider: () => new HDWalletProvider(
				mnemonic,
				"http://127.0.0.1:8545",
			),
		},
		ropsten: {
			provider: () =>
				new HDWalletProvider(
					mnemonic,
					`https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
				),
			network_id: 3, // Ropsten's id
			gas: 5500000, // Ropsten has a lower block limit than mainnet
			confirmations: 0, // # of confs to wait between deployments. (default: 0)
			timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
			skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
			from: "0x9caac43ffad11f4f0c381844a6b6d5eeb3f8f030",
		},
	},

	// Configure your compilers
	compilers: {
		solc: {
			version: "0.8.11",
		}
	},
};
