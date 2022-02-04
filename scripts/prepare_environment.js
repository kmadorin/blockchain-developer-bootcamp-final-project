const IWETH = require('../artifacts/contracts/interfaces/IWETH.sol/IWETH.json');
const TokenMock = require('../artifacts/contracts/mocks/TokenMock.sol/TokenMock.json');
const MockAggregator = require('../artifacts/contracts/mocks/MockAggregator.sol/MockAggregator.json');

const fs = require(`fs`).promises;
const path = require(`path`);
const LendingPoolAddressesProvider = require("@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json");
const LendingPool = require("@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json");
const AaveOracle = require("@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json");
const hre = require('hardhat');
// const {web3} = require("@openzeppelin/test-helpers/src/setup");
const web3 = hre.web3;
const {toBN} = require("../hardhat_tests/helpers/utils");
const { ether, BN } = require('@openzeppelin/test-helpers');

async function run() {
	const WAD = toBN(10).pow(toBN(18));

	const ASSET_ADDRESSES = {
		DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
		WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		GUSD: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
		UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
	};

	const aaveLendingPoolAddressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
	const aaveOracleAddress = '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9';
	const aaveOracleOwnerAddress = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';

	const lendingPoolAddressProvider = new web3.eth.Contract(LendingPoolAddressesProvider.abi, aaveLendingPoolAddressProvider);
	const lendingPoolAddress = await lendingPoolAddressProvider.methods.getLendingPool().call();
	const lendingPool = new web3.eth.Contract(LendingPool.abi, lendingPoolAddress);
	const aaveOracle = new web3.eth.Contract(AaveOracle.abi, aaveOracleAddress);

	const weth = new web3.eth.Contract(IWETH.abi, ASSET_ADDRESSES.WETH);
	const dai = new web3.eth.Contract(TokenMock.abi, ASSET_ADDRESSES.DAI);

	const accounts = await hre.web3.eth.getAccounts();
	const wallet = accounts[0];

	const mockAggregator = new web3.eth.Contract(MockAggregator.abi);
	const mockAggregatorDeployed = await mockAggregator.deploy({data: MockAggregator.bytecode, arguments: [1000]}).send({from: wallet});

	console.log(`###: mockAggregator`, mockAggregatorDeployed.options.address)

	// deposit 2 WETH to Aaave
	await weth.methods.deposit().send({from: wallet, value: ether('2')});
	await weth.methods.approve(lendingPoolAddress, ether('2')).send({from: wallet});
	await lendingPool.methods.deposit(ASSET_ADDRESSES.WETH, ether('2'), wallet, 0).send({from: wallet});

	// borrow maximum available amount of DAI
	const userData = await lendingPool.methods.getUserAccountData(wallet).call();
	const assetPriceInEth = await aaveOracle.methods.getAssetPrice(ASSET_ADDRESSES.DAI).call();
	const maxBorrow = (new BN(userData.availableBorrowsETH)).mul(WAD).div((new BN(assetPriceInEth)));
	await lendingPool.methods.borrow(ASSET_ADDRESSES.DAI, maxBorrow, 2, 0, wallet).send({from: wallet});

	// replace Aave Oracle with MockAggregator and increase DAI price to make the loan unhealthy
	const newAssetPriceInEth = (new BN(assetPriceInEth)).mul(toBN(2));
	await mockAggregatorDeployed.methods.setLatestAnswer(newAssetPriceInEth).send({from: wallet});
	await hre.network.provider.send("hardhat_impersonateAccount", [aaveOracleOwnerAddress]);
	await web3.eth.sendTransaction({to: aaveOracleOwnerAddress, from: wallet, value: ether('6')});

	const userDataBefore= await lendingPool.methods.getUserAccountData(wallet).call();
	console.log(`###: userDataAfter`, userDataBefore);

	try {
		await aaveOracle.methods.setAssetSources([ASSET_ADDRESSES.DAI], [mockAggregatorDeployed.options.address]).send({from: aaveOracleOwnerAddress});
	} catch(e) {
	  console.log(e);
	}

	const userDataAfter= await lendingPool.methods.getUserAccountData(wallet).call();
	console.log(`###: userDataAfter`, userDataAfter);

	try {
		const position = {
			userAddress: wallet,
			totalCollateralETH: userDataAfter.totalCollateralETH,
			totalDebtETH: userDataAfter.totalDebtETH,
			healthFactor: userDataAfter.healthFactor,
		}
		await fs.writeFile(path.resolve(__dirname, '../frontend/src/positions.json'), JSON.stringify([position]));
		console.log(`Positions file created`);
	} catch (err) {
		console.error(`Error`, err);
	}
}

run();

