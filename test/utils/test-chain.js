require("dotenv").config();

const ganache = require("ganache-core");

const PORT = 8545;

const Web3 = require("web3");

// fork off mainnet with a specific account preloaded with 1000 ETH
const server = ganache.server({
	port: PORT,
	fork: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
	network_id: 1,
	mnemonic: process.env.MNEMONIC,
	unlockedAccounts: ['0x9e0f0d83dD880240e3506A7Ac4CE82500b2bD92B'],
});

server.listen(PORT, async (err, chain) => {
	if (err) {
		console.log(err);
	} else {
		const provider = server.provider;
		const web3 = new Web3(provider);
		const accounts = await web3.eth.getAccounts();

		console.log(`Forked off of node: ${process.env.MAINNET_NODE_URL}\n`);
		console.log(`Test accounts:\n`);
		accounts.forEach(account => console.log(`${account}`));
		console.log(`\nTest chain started on port ${PORT}, listening...`);
	}
});
