require("dotenv").config();

const { ethers } = require("ethers");
const Ganache = require("ganache-core");
const NodeEnvironment = require("jest-environment-node");
const PORT = 8545;

const Web3 = require("web3");

const startChain = async () => {
	const ganache = Ganache.provider({
		port: PORT,
		fork: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
		network_id: 1,
		mnemonic: process.env.MNEMONIC,
	});

	const web3 = new Web3(Ganache.provider());

	const accounts = await web3.eth.getAccounts();

	return {accounts};
};

class CustomEnvironment extends NodeEnvironment {

	constructor(config, context) {
		super(config);
		this.testPath = context.testPath;
		this.docblockPragmas = context.docblockPragmas;
	}

	async setup() {
		await super.setup();

		const { accounts } = await startChain();
		this.accounts = accounts;
		this.global.accounts = accounts;
	}

	async teardown() {
		await super.teardown();
	}

	runScript(script) {
		return super.runScript(script);
	}
}

module.exports = CustomEnvironment;
