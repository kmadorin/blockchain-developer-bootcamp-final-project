// Traditional Truffle test
const {ether, expectRevert, BN} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const axios = require('axios');
require('dotenv').config();

const hre = require('hardhat');

const MockAggregator = artifacts.require('MockAggregator');
const TokenMock = artifacts.require('TokenMock');
const LimitOrderProtocol = artifacts.require('LimitOrderProtocol');

const IProtocolDataProvider = artifacts.require('IProtocolDataProvider');

const ILimitOrderProtocol = artifacts.require('ILimitOrderProtocol');
const IWETH = artifacts.require('IWETH');
const DSProxyCache = artifacts.require('DSProxyCache');
const DSProxyFactory = artifacts.require('DSProxyFactory');
const DSProxyRegistry = artifacts.require('DSProxyRegistry');
const DSGuard = artifacts.require('DSGuard');
const SmartWallet = artifacts.require('SmartWallet');

const Liquidator = artifacts.require('Liquidator');
const SimpleContract = artifacts.require('SimpleContract');

const LendingPoolAddressesProvider = require("@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json");
const LendingPool = require("@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json");
const AaveOracle = require("@aave/protocol-v2/artifacts/contracts/misc/AaveOracle.sol/AaveOracle.json");

const {buildOrderData, ABIOrder} = require('./helpers/orderUtils');
const {cutLastArg, toBN} = require('./helpers/utils');
const {web3} = require('@openzeppelin/test-helpers/src/setup');
const {fetchV2UnhealthyLoans, getUserSummary, getRawReservesData, getUserReservesData} = require('./utils/aaveUtils');


contract('Inchi', async function ([wallet, _]) {
	// const privateKey = process.env.POLYGON_PRIVATE_KEY;
	// const contractOwner = web3.eth.accounts.privateKeyToAccount(privateKey);
	// const contractOwnerAddress = contractOwner.address;

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
			Liquidator: '0x3890EB1F4928C8C0aB05d474b08f78950d25Ce45',
		}
	}

	const network = 'polygon';

	const {
		aaveProtocolDataProviderAddress,
		aaveLendingPoolAddressProvider,
		aaveOracle,
		aaveOracleOwner,
		limitOrderProtocolAddress
	} = CONTRACTS_ADDRESSES[network];
	const zeroAddress = '0x0000000000000000000000000000000000000000';
	const WAD = toBN(10).pow(toBN(18));

	const ASSET_ADDRESSES = {
		mainnet: {
			DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
			WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
			GUSD: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
			UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
		},
		polygon: {
			WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
			DAI: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
			USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
		}
	};

	function buildOrder(
		exchange,
		makerAsset,
		takerAsset,
		makingAmount,
		takingAmount,
		maker,
		allowedSender = zeroAddress,
		predicate = '0x',
		permit = '0x',
		interaction = '0x',
		receiver = zeroAddress,
	) {
		return buildOrderWithSalt(exchange, '1', makerAsset, takerAsset, makingAmount, takingAmount, maker, allowedSender, predicate, permit, interaction, receiver);
	}

	function buildOrderWithSalt(
		exchange,
		salt,
		makerAsset,
		takerAsset,
		makingAmount,
		takingAmount,
		maker,
		allowedSender = zeroAddress,
		predicate = '0x',
		permit = '0x',
		interaction = '0x',
		receiver = zeroAddress,
	) {
		return {
			salt: salt,
			makerAsset: makerAsset.address,
			takerAsset: takerAsset.address,
			maker,
			receiver,
			allowedSender,
			makingAmount,
			takingAmount,
			makerAssetData: '0x',
			takerAssetData: '0x',
			getMakerAmount: cutLastArg(exchange.contract.methods.getMakerAmount(makingAmount, takingAmount, 0).encodeABI()),
			getTakerAmount: cutLastArg(exchange.contract.methods.getTakerAmount(makingAmount, takingAmount, 0).encodeABI()),
			predicate: predicate,
			permit: permit,
			interaction: interaction,
		};
	}

	beforeEach(async function () {
		this.simpleContract = await SimpleContract.new(aaveLendingPoolAddressProvider, aaveOracle);

		// this.swap = await ILimitOrderProtocol.at(limitOrderProtocol);
		// this.swap = await LimitOrderProtocol.at(CONTRACTS_ADDRESSES[network]['limitOrderProtocolAddressV2']);

		this.swap = await LimitOrderProtocol.new();
		// this.liquidator = await Liquidator.new(this.swap.address, aaveLendingPoolAddressProvider, aaveOracle);
		// this.liquidator = await Liquidator.at(CONTRACTS_ADDRESSES[network]['Liquidator']);
		// this.smartwallet = await SmartWallet.new(this.dsproxyCache.address, this.swap.address);
		// this.MockAggregator = await MockAggregator.new('10000');
		this.dsproxyFactory = await DSProxyFactory.new(this.swap.address);
		this.dsproxyRegistry = await DSProxyRegistry.new(this.dsproxyFactory.address);
		this.dsguard = await DSGuard.new();
		await this.dsproxyRegistry.build({from: wallet});
		const smartWalletAddress = await this.dsproxyRegistry.wallets(wallet);
		this.smartwallet = await SmartWallet.at(smartWalletAddress);

		this.protocolDataProvider = await IProtocolDataProvider.at(aaveProtocolDataProviderAddress);
		this.lendingPoolAddressProvider = new web3.eth.Contract(LendingPoolAddressesProvider.abi, aaveLendingPoolAddressProvider);
		const lendingPoolAddress = await this.lendingPoolAddressProvider.methods.getLendingPool().call();

		this.lendingPool = new web3.eth.Contract(LendingPool.abi, lendingPoolAddress);
		// this.aaveOracle = new web3.eth.Contract(AaveOracle.abi, aaveOracle);

		(network !== "polygon") && (this.weth = await IWETH.at(ASSET_ADDRESSES[network].WETH));
		(network === "polygon") && (this.wmatic = await IWETH.at(ASSET_ADDRESSES[network].WMATIC));
		this.dai = await TokenMock.at(ASSET_ADDRESSES[network].DAI);

		this.usdc = await TokenMock.at(ASSET_ADDRESSES[network].USDC);
	});

	describe('Smart Wallet', function () {
		// it('should execute arbitrary function via SmartWallet', async function () {
		// 	const accountsToImpersonate = {
		// 		mainnet: '0x7e0188b0312a26ffe64b7e43a7a91d430fb20673',
		// 		polygon: '0xab5167e8cc36a3a91fd2d75c6147140cd1837355'
		// 	}
		// 	const accountToImpersonate = accountsToImpersonate[network];
		//
		// 	await hre.network.provider.send("hardhat_impersonateAccount", [accountToImpersonate]);
		// 	await web3.eth.sendTransaction({to: accountToImpersonate, from: wallet, value: ether('6')});
		//
		//
		// 	//send 1000 usdc to wallet
		// 	await this.usdc.transfer(this.smartwallet.address, 1000000000, {from: accountToImpersonate});
		//
		// 	const calldata = this.simpleContract.contract.methods.deposit(ASSET_ADDRESSES[network].USDC, 1000000000).encodeABI();
		// 	await this.smartwallet.contract.methods['execute(address,bytes)'](this.simpleContract.address, calldata).send({from: wallet});
		//
		// 	return true;
		// });

		it('shoulde create limit order from SmartWallet', async function () {
			const accountsToImpersonate = {
				mainnet: '0x7e0188b0312a26ffe64b7e43a7a91d430fb20673',
				polygon: '0xab5167e8cc36a3a91fd2d75c6147140cd1837355'
			}
			const accountToImpersonate = accountsToImpersonate[network];

			await hre.network.provider.send("hardhat_impersonateAccount", [accountToImpersonate]);
			await web3.eth.sendTransaction({to: accountToImpersonate, from: wallet, value: ether('6')});

			await this.wmatic.deposit({from: wallet, value: ether('2')});
			//send 1000 usdc to wallet
			await this.usdc.transfer(this.smartwallet.address, 1000000000, {from: accountToImpersonate});

			const order = buildOrder(this.swap, this.usdc, this.wmatic, 1, 1, this.smartwallet.address);
			// const calldata = this.simpleContract.contract.methods.deposit(ASSET_ADDRESSES[network].USDC, 1000000000).encodeABI();
			const calldata = this.simpleContract.contract.methods.approveAndSayHello(this.usdc.address, 11, this.swap.address).encodeABI();
			order.interaction = this.smartwallet.address + this.simpleContract.address.slice(2) + calldata.slice(2);
			const signature = web3.eth.abi.encodeParameter(ABIOrder, order);
			await this.wmatic.approve(this.swap.address, 1, {from: wallet});

			await this.smartwallet.setAuthorityByAddress(this.dsguard.address);
			const ANY = await this.dsguard.ANY();
			await this.dsguard.permit(this.swap.address, ANY, ANY);

			console.log(`###: wallet`, wallet);
			console.log(`###: this.simpleContract.address`, this.simpleContract.address);
			console.log(`###: this.smartwallet.address`, this.smartwallet.address);
			console.log(`###: this.swap.address`, this.swap.address);
			try {
				// fill order
				// const userDataBefore = await this.lendingPool.methods.getUserAccountData(this.smartwallet.address).call();
				// console.log(`###: userDataBefore`, userDataBefore);
				const receipt = await this.swap.fillOrder(order, signature, 0, 1, 1, {
					from: wallet,
				});

				// const userDataAfter = await this.lendingPool.methods.getUserAccountData(this.smartwallet.address).call();
				// console.log(`###: userDataAfter`, userDataAfter);
			} catch (e) {
				console.log(e);
			}

			return true;
		});
	});
	// describe('liquidate()', function () {
	// 	it('should liquidate unhealthy Aave position', async function () {
	// 		// const unhealthyLoans = await fetchV2UnhealthyLoans();
	// 		// // const USDCLoans = unhealthyLoans.filter(loan => loan.maxBorrowSymbol === "USDC").sort((a, b) => a.healthFactor - b.healthFactor);
	// 		// const USDCLoans = unhealthyLoans.sort((a, b) => a.healthFactor - b.healthFactor);
	// 		//
	// 		// const rawReservesData = await getRawReservesData();
	//
	// 		// const gasEstimate = 683485;
	// 		const gasEstimate = 91559;
	// 		const estimatedGasPrice = await web3.eth.getGasPrice();
	// 		const estimatedOrderFillPrice = (new BN(estimatedGasPrice)).mul(new BN(gasEstimate));
	//
	// 		// const loansChecking = USDCLoans.map(async (loan) => {
	// 		// 	loan.profitable = false;
	// 		// 	const rawUserReservesData = await getUserReservesData(loan.userAddress, rawReservesData);
	// 		// 	const userSummary = await getUserSummary(loan.userAddress, rawReservesData, rawUserReservesData);
	// 		//
	// 		// 	const collateralReserve = userSummary.reservesData.find(item => item.reserve.symbol === loan.maxCollateralSymbol);
	// 		// 	const borrowReserve = userSummary.reservesData.find(item => item.reserve.symbol === loan.maxBorrowSymbol);
	// 		// 	loan.maxBorrowAmountOld = loan.maxBorrowAmount;
	// 		// 	loan.maxBorrowAmount = borrowReserve.totalBorrows.replace('.', '').replace(/^0+/, '');
	// 		// 	loan.maxCollateralAmountOld = loan.maxCollateralAmount;
	// 		// 	loan.maxCollateralAmount = collateralReserve.underlyingBalance.replace('.', '').replace(/^0+/, '');
	// 		// 	loan.maxCollateralAmountETH = web3.utils.toWei(collateralReserve.underlyingBalanceETH, 'ether');
	// 		// 	loan.maxBorrowAmountETH = web3.utils.toWei(borrowReserve.totalBorrowsETH, 'ether');
	// 		// 	loan.maxCollateralReserve = collateralReserve;
	// 		// 	loan.maxBorrowReserve = borrowReserve;
	// 		//
	// 		// 	const userData = await this.lendingPool.methods.getUserAccountData(loan.userAddress).call();
	// 		// 	// console.log(`###: userData.healthFactor`, userData.healthFactor);
	// 		// 	loan.healthFactor = web3.utils.fromWei(userData.healthFactor, 'ether');
	// 		//
	// 		// 	loan.estimatedLiquidationBonusETH = new BN(loan.maxBorrowAmountETH).divn(2).muln(+loan.maxCollateralBonus - 10000).divn(10000)
	// 		//
	// 		// 	if (loan.estimatedLiquidationBonusETH.gt(estimatedOrderFillPrice)) {
	// 		// 		loan.profitable = true;
	// 		// 	}
	// 		//
	// 		// 	return loan;
	// 		// });
	// 		//
	// 		//
	// 		// const all_loans = await Promise.all(loansChecking);
	// 		// const profitable_loans = all_loans.filter(loan => loan.profitable).sort((a, b) => (new BN(a.maxBorrowAmountETH)).gt((new BN(b.maxBorrowAmountETH)) ? 1 : -1));
	// 		// const all_loans_sorted_by_debt = all_loans.filter(loan => loan.healthFactor < 1).sort((a, b) => {
	// 		// 	if (new BN(b.maxBorrowAmountETH).gt(new BN(a.maxBorrowAmountETH))) {
	// 		// 		console.log('gt');
	// 		// 		return 1
	// 		// 	} else {
	// 		// 		console.log('lt');
	// 		// 		return -1;
	// 		// 	}
	// 		// });
	// 		// console.log(`###: all_loans_sorted_by_debt`, all_loans_sorted_by_debt.map(loan => loan.maxBorrowAmountETH));
	// 		//
	// 		// if (profitable_loans.length === 0) {
	// 		// 	console.log('there are no profitable loans')
	// 		// 	return false;
	// 		// }
	//
	// 		// console.log(`###: all_loans`, all_loans.length);
	//
	// 		// const loan = profitable_loans[0];
	// 		// const loan = all_loans_sorted_by_debt[0];
	//
	// 		const loan = {
	// 			userAddress: '0xede4d8b7b6d29fa5b6ee9b2b8f5f3eb92d24e09b',
	// 			healthFactor: '0.836972130457837487',
	// 			debtToCover: '78463',
	// 			debtTokenAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
	// 			debtTokenDecimals: 6,
	// 			collateralAmount: '44398973538026309',
	// 			collateralTokenAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
	// 			collateralTokenDecimals: 18,
	// 			collateralBonus: 10800,
	// 			liquidationBonus: '4439897353802630',
	// 			liquidationBonusETH: '2791807456071',
	// 			collateralTokenSymbol: 'WMATIC',
	// 			debtTokenSymbol: 'USDC'
	// 		};
	//
	//
	// 		// const userData = await this.lendingPool.methods.getUserAccountData(loan.userAddress).call();
	// 		//
	// 		// const dataCollateral = await this.protocolDataProvider.getUserReserveData(loan.collateralTokenAddress, loan.userAddress);
	// 		// const dataBorrow = await this.protocolDataProvider.getUserReserveData(loan.debtTokenAddress, loan.userAddress);
	// 		//
	// 		// loan.healthFactor = userData.healthFactor;
	// 		// loan.maxCollateralAmount = dataCollateral.currentATokenBalance;
	// 		// loan.maxBorrowAmount = dataBorrow.currentStableDebt.add(dataBorrow.currentVariableDebt);
	// 		//
	// 		// loan.debtToCover = (loan.maxBorrowAmount).divn(2);
	// 		// loan.collateralTokenPriceInETH = await this.aaveOracle.methods.getAssetPrice(loan.collateralTokenAddress).call();
	// 		// loan.borrowTokenPriceInETH = await this.aaveOracle.methods.getAssetPrice(loan.debtTokenAddress).call();
	// 		//
	// 		// // collateral amount that will be received after the liquidation
	// 		// // doesn't include bonus
	// 		// loan.collateralAmount = loan.debtToCover.mul(new BN(loan.borrowTokenPriceInETH)).div(new BN('10').pow(new BN(loan.maxBorrowReserve.reserve.decimals))).mul(new BN('10').pow(new BN(loan.maxCollateralReserve.reserve.decimals))).div(new BN(loan.collateralTokenPriceInETH)).muln(+loan.maxCollateralBonus).divn(10000);
	// 		// loan.liquidationBonus = loan.collateralAmount.muln(loan.maxCollateralBonus - 10000).divn(10000);
	// 		// loan.liquidationBonusETH = loan.liquidationBonus.mul(new BN(loan.collateralTokenPriceInETH)).div(new BN(10).pow(new BN(loan.maxCollateralReserve.reserve.decimals)));
	//
	// 		const debtTokenContract = await TokenMock.at(loan.debtTokenAddress);
	// 		const collateralTokenContract = await TokenMock.at(loan.collateralTokenAddress);
	// 		const accountsToImpersonate = {
	// 			mainnet: '0x7e0188b0312a26ffe64b7e43a7a91d430fb20673',
	// 			polygon: '0xab5167e8cc36a3a91fd2d75c6147140cd1837355'
	// 		}
	// 		const accountToImpersonate = accountsToImpersonate[network];
	//
	// 		await hre.network.provider.send("hardhat_impersonateAccount", [accountToImpersonate]);
	// 		await hre.network.provider.send("hardhat_impersonateAccount", [contractOwnerAddress]);
	//
	// 		await web3.eth.sendTransaction({to: contractOwnerAddress, from: wallet, value: ether('6')});
	//
	// 		await web3.eth.sendTransaction({to: accountToImpersonate, from: wallet, value: ether('6')});
	//
	//
	// 		await debtTokenContract.transfer(wallet, loan.debtToCover, {from: accountToImpersonate});
	//
	// 		//----
	// 		// const debtTokenBalanceAfterTransfer = await debtTokenContract.balanceOf(wallet);
	// 		// await debtTokenContract.approve(this.lendingPool._address, loan.debtToCover, {from: wallet});
	// 		// const ethBalanceBefore = await web3.eth.getBalance(wallet);
	// 		// const collateralTokenBalanceBefore = await collateralTokenContract.balanceOf(wallet);
	// 		// console.log(`###: collateralTokenBalanceBefore`, collateralTokenBalanceBefore);
	// 		// console.log('\n ------\n Position info: \n --------')
	// 		// console.log(`###: User's address`, loan.userAddress);
	// 		// // console.log(`###: health factor:`, web3.utils.fromWei(loan.healthFactor, 'ether'));
	// 		// console.log(`###: collateral token symbol: `, loan.maxCollateralSymbol);
	// 		// // console.log(`###: collateral token amount: `, loan.maxCollateralAmount.toString());
	// 		// console.log(`###: liquidation bonus:`, loan.liquidationBonus.toString());
	// 		// console.log(`###: liquidation bonus ETH: `, loan.liquidationBonusETH)
	// 		// console.log(`###: debt token symbol: `, loan.maxBorrowSymbol);
	// 		// // console.log(`###: debt token amount: `, loan.maxBorrowAmount.toString());
	// 		//
	// 		// console.log('\n ------ Amounts for the liquidation: \n ----');
	// 		// console.log(`###: debtToCover`, loan.debtToCover.toString());
	// 		// console.log(`###: collateralAmount`, loan.collateralAmount.toString());
	// 		//
	// 		// const liquidationCall = await this.lendingPool.methods.liquidationCall(loan.collateralTokenAddress, loan.debtTokenAddress, loan.userAddress, loan.debtToCover, false).send({from: wallet});
	// 		// const collateralTokenBalanceAfter = await collateralTokenContract.balanceOf(wallet);
	// 		// const ethBalanceAfter = await web3.eth.getBalance(wallet);
	// 		//
	// 		// const debtTokenBalanceAfterLiquidation = await debtTokenContract.balanceOf(wallet);
	// 		//
	// 		// console.log('------\n Amounts after the liquidation: \n-------');
	// 		// console.log(`###: debtToken spent during the liquidation`, (new BN(debtTokenBalanceAfterTransfer)).sub(new BN(debtTokenBalanceAfterLiquidation)).toString());
	// 		// console.log('###: collateralToken received after the liquidation', collateralTokenBalanceAfter.sub(collateralTokenBalanceBefore).toString());
	// 		// console.log('###: expected collateral token amount after the liquidation', loan.collateralAmount.toString());
	// 		//
	// 		// console.log(`###: gas fees:`, web3.utils.fromWei((new BN(ethBalanceBefore)).sub(new BN(ethBalanceAfter)), 'ether').toString());
	// 		// const collateralAmount = await this.liquidator.getMakerAmount(loan.debtToCover, loan.debtToCover, loan.debtTokenAddress, loan.collateralTokenAddress, loan.collateralBonus, loan.debtTokenDecimals, loan.collateralTokenDecimals, loan.debtToCover);
	// 		// console.log(`###: collateralAmount`, collateralAmount.toString());
	// 		// const takerAmount = await this.liquidator.getTakerAmount(loan.debtToCover, loan.debtToCover, loan.debtTokenAddress, loan.collateralTokenAddress, loan.collateralBonus, loan.debtTokenDecimals, loan.collateralTokenDecimals, loan.collateralAmount);
	// 		// console.log(`###: debtAmount`, takerAmount.toString());
	//
	// 		//-----
	// 		const isHFBelowThresholdCall = this.liquidator.contract.methods.isHFBelowThreshold(loan.userAddress, WAD).encodeABI();
	// 		const isHFBelowThreshold = await this.liquidator.isHFBelowThreshold(loan.userAddress, WAD);
	// 		console.log(`###: isHFBelowThreshold`, isHFBelowThreshold);
	// 		const predicate = this.swap.contract.methods.arbitraryStaticCall(this.liquidator.address, isHFBelowThresholdCall).encodeABI();
	//
	// 		// const predicate = '0x';
	// 		const order = buildOrder(this.swap, collateralTokenContract, debtTokenContract, loan.collateralAmount, loan.debtToCover, this.liquidator.address, zeroAddress, predicate);
	// 		order.getMakerAmount = cutLastArg(
	// 			this.swap.contract.methods.arbitraryStaticCall(
	// 				this.liquidator.address,
	// 				this.liquidator.contract.methods.getMakerAmount(loan.debtToCover, loan.debtToCover, loan.debtTokenAddress, loan.collateralTokenAddress, loan.collateralBonus, loan.debtTokenDecimals, loan.collateralTokenDecimals, 0).encodeABI()
	// 			).encodeABI(),
	// 			56
	// 		);
	//
	// 		order.getTakerAmount = '0x';
	//
	// 		order.interaction = this.liquidator.address + loan.userAddress.slice(2);
	//
	// 		const signature = web3.eth.abi.encodeParameter(ABIOrder, order);
	// 		const orderHash = await this.swap.hashOrder(order);
	//
	// 		console.log(`###: orderHash`, orderHash);
	// 		const orderToSend = {
	// 			orderHash,
	// 			signature,
	// 			data: {
	// 				makerAsset: order.makerAsset,
	// 				takerAsset: order.takerAsset,
	// 				maker: order.maker,
	// 				allowedSender: order.allowedSender,
	// 				receiver: order.receiver,
	// 				makingAmount: order.makingAmount,
	// 				takingAmount: order.takingAmount,
	// 				makerAssetData: order.makerAssetData,
	// 				takerAssetData: order.takerAssetData,
	// 				getMakerAmount: order.getMakerAmount,
	// 				getTakerAmount: order.getTakerAmount,
	// 				salt: order.salt,
	// 				predicate: order.predicate,
	// 				permit: order.permit,
	// 				interaction: order.interaction
	// 			}
	// 		}
	//
	// 		console.log(`###: orderToSend`, JSON.stringify(orderToSend, null, 2));
	//
	//
	// 		// //approve takerAmount by taker
	// 		// await debtTokenContract.approve(this.swap.address, loan.debtToCover, {from: wallet});
	// 		// const ethBalanceBefore = await web3.eth.getBalance(wallet);
	// 		// console.log(`###: ethBalanceBefore`, ethBalanceBefore);
	// 		// const balanceBefore = await collateralTokenContract.balanceOf(wallet);
	// 		// console.log(`###: balanceBefore`, balanceBefore.toString());
	// 		// await this.liquidator.approveMax(loan.debtTokenAddress, this.lendingPool._address, {from: contractOwnerAddress});
	// 		// await this.liquidator.approveMax(loan.collateralTokenAddress, this.swap.address, {from: contractOwnerAddress});
	// 		// // await this.liquidator.approveMax(loan.debtTokenAddress, this.lendingPool._address, {from: wallet});
	// 		// // await this.liquidator.approveMax(loan.collateralTokenAddress, this.swap.address, {from: wallet});
	// 		//
	// 		// // try to fill the order
	// 		// try {
	// 		// 	// fill order
	// 		// 	// const receipt = await this.swap.fillOrder(order, signature, 0, debtToCover, debtToCover, {from: wallet, gasPrice: web3.utils.toWei('168', 'gwei')});
	// 		// 	const receipt = await this.swap.fillOrder(order, signature, 0, loan.debtToCover, 1000, {
	// 		// 		from: wallet,
	// 		// 		gasPrice: estimatedGasPrice
	// 		// 	});
	// 		// 	const gasUsed = receipt.receipt.gasUsed;
	// 		// 	console.log(`###: receipt.receipt.gasUsed`, gasUsed);
	// 		// 	const tx = await web3.eth.getTransaction(receipt.tx);
	// 		// 	const gasPrice = tx.gasPrice;
	// 		// 	console.log(`###: gasPrice`, gasPrice);
	// 		// 	console.log('###: txPrice:', web3.utils.fromWei((new BN(gasPrice)).mul(new BN(gasUsed)).toString(), 'ether'));
	// 		// } catch (e) {
	// 		// 	console.log(e);
	// 		// }
	// 		//
	// 		// const balanceAfter = await collateralTokenContract.balanceOf(wallet);
	// 		// console.log(`###: balanceAfter`, balanceAfter.toString());
	// 		// const liquidationBonus = await collateralTokenContract.balanceOf(this.liquidator.address);
	// 		// console.log(`###: liquidationBonus`, liquidationBonus.toString());
	// 		// const ethBalanceAfter = await web3.eth.getBalance(wallet);
	// 		// console.log(`###: ethBalanceAfter`, ethBalanceAfter);
	// 		// console.log(`###: ethDelta`, web3.utils.fromWei((new BN(ethBalanceBefore)).sub(new BN(ethBalanceAfter)), 'ether').toString());
	//
	// 		return true;
	// 	});
	// })

	// describe('setFee()', function() {
	//   it('should set fee by the owner', async function() {
	// try to set 10% fee
	//     const newFee = WAD.div(10);
	//     await this.liquidator.setFee(WAD.div(10));
	//     expect(await this.liquidator.fee()).to.be.bignumber.equal(newFee);
	//   });
	//
	//   it('should revert when setting fee not by the owner', async function() {
	//     const newFee = WAD.div(10);
	//     await expectRevert(this.liquidator.setFee(newFee, {from: wallet}), 'Only owner');
	//   });
	// });

	// describe('fill order', function () {
	// it('should liquidate unhealthy position on order fill', async function() {
	//   // deposit 2 WETH to Aaave
	//   await this.weth.deposit({from: wallet, value: ether('2')});
	//   await this.weth.approve(this.lendingPool._address, ether('2'), {from: wallet});
	//   await this.lendingPool.methods.deposit(ASSET_ADDRESSES[network].WETH, ether('2'), wallet, 0).send({from: wallet});
	//
	//   // borrow maximum available amount of DAI
	//   const userData = await this.lendingPool.methods.getUserAccountData(wallet).call();
	//
	//   const assetPriceInEth = await this.aaveOracle.methods.getAssetPrice(this.dai.address).call();
	//   const maxBorrow = (new BN(userData.availableBorrowsETH)).mul(WAD).div((new BN(assetPriceInEth)));
	//   await this.lendingPool.methods.borrow(this.dai.address, maxBorrow, 2, 0, wallet).send({from: wallet});
	//
	//   const healthFactorBeforePriceChanged = await this.liquidator.getHealthFactor(wallet);
	//
	//   console.log(`###: healthFactorBeforePriceChanged`, web3.utils.fromWei(healthFactorBeforePriceChanged, 'ether'))
	//
	//   // replace Aave Oracle with MockAggregator and increase DAI price to make the loan unhealthy
	//   const newAssetPriceInEth = (new BN(assetPriceInEth)).mul(toBN(2)).div(toBN(1));
	//   await this.MockAggregator.setLatestAnswer(newAssetPriceInEth);
	//   await hre.network.provider.send("hardhat_impersonateAccount", [aaveOracleOwner]);
	//   await web3.eth.sendTransaction({to: aaveOracleOwner, from: wallet, value: ether('5')});
	//   await this.aaveOracle.methods.setAssetSources([this.dai.address], [this.MockAggregator.address]).send({from: aaveOracleOwner});
	//
	//
	//   const userDataAfterPriceChanged = await this.lendingPool.methods.getUserAccountData(wallet).call();
	//   const healthFactorAfterPriceChanged = await this.liquidator.getHealthFactor(wallet);
	//
	//   console.log(`###: healthFactorAfterPriceChanged`, web3.utils.fromWei(healthFactorAfterPriceChanged, 'ether'))
	//   // create 1inch limit order that will liquidate this loan on fill
	//   // makerAmount = 50% of collateral
	//   // takerAmount = 50% of debt
	//   // predicate = health factor below 1
	//   // signature = order itself, isValidSignature will check if hash(order params in signature) is the same as order hash
	//   const walletDAIBalance = await this.dai.balanceOf(wallet);
	//   const purchaseAmount = toBN(walletDAIBalance).divn(2);
	//   const collateralAmount = purchaseAmount.mul(newAssetPriceInEth).div(WAD).muln(101).divn(100);
	//   console.log(`###: collateralAmount`, collateralAmount.toString());
	//
	//   // const hfCall = this.liquidator.contract.methods.getHealthFactor(wallet).encodeABI();
	//   const isHFBelowThresholdCall = this.liquidator.contract.methods.getHealthFactor(wallet).encodeABI();
	//   const predicate = this.swap.contract.methods.arbitraryStaticCall(this.liquidator.address, isHFBelowThresholdCall).encodeABI();
	//
	//   // TODO: implement getTakerAmount and getMakerAmount to get debtToCover on fill including interest
	//   const order = buildOrder(this.swap, this.weth, this.dai, collateralAmount, purchaseAmount, this.liquidator.address, zeroAddress, predicate);
	//   order.interaction = web3.eth.abi.encodeParameters(['address', 'address', 'address', 'uint256', 'bool'], [this.weth.address, this.dai.address, wallet, purchaseAmount, false]);
	//
	//   const signature = web3.eth.abi.encodeParameter(ABIOrder, order);
	//
	//   //approve takerAmount by taker
	//   await this.dai.approve(this.swap.address, purchaseAmount, {from: wallet});
	//
	//   // try to fill the order
	//   try {
	//     // fill order
	//     const receipt = await this.swap.fillOrder(order, signature, collateralAmount, 0, purchaseAmount, {from: wallet});
	//   } catch (e) {
	//     console.log(e);
	//   }
	//
	//   const healthFactorAfterLiquidation = await this.liquidator.getHealthFactor(wallet);
	//   console.log('Position has been successfully liquidated, new health factor is: ', web3.utils.fromWei(healthFactorAfterLiquidation, 'ether'));
	//
	//   const userDataAfterLiquidation = await this.lendingPool.methods.getUserAccountData(wallet).call();
	//   console.log(`###: userDataAfterPriceChanged`, userDataAfterPriceChanged);
	//   console.log(`###: userDataAfterLiquidation`, userDataAfterLiquidation);
	//
	//   return true;
	// });

	// it('should revert on filling the order with a healthy position', async function() {
	//   // deposit 2 WETH to Aaave
	//   await this.weth.deposit({from: wallet, value: ether('2')});
	//   await this.weth.approve(this.lendingPool._address, ether('2'), {from: wallet});
	//   await this.lendingPool.methods.deposit(ASSET_ADDRESSES[network].WETH, ether('2'), wallet, 0).send({from: wallet});
	//
	//   // borrow maximum available amount of DAI
	//   const userData = await this.lendingPool.methods.getUserAccountData(wallet).call();
	//
	//   const assetPriceInEth = await this.aaveOracle.methods.getAssetPrice(this.dai.address).call();
	//   //borrow half of a availableBorrows in DAI
	//   const amountToBorrow = (new BN(userData.availableBorrowsETH)).mul(WAD).div(toBN(2)).div((new BN(assetPriceInEth)));
	//   await this.lendingPool.methods.borrow(this.dai.address, amountToBorrow, 2, 0, wallet).send({from: wallet});
	//
	//
	//   // create 1inch limit order that will liquidate this loan on fill
	//   // makerAmount = 50% of collateral
	//   // takerAmount = 50% of debt
	//   // predicate = health factor below 1
	//   // signature = order itself, isValidSignature will check if hash(order params in signature) is the same as order hash
	//
	//   const isHFBelowThresholdCall = this.liquidator.contract.methods.getHealthFactor(wallet).encodeABI();
	//   const predicate = this.swap.contract.methods.arbitraryStaticCall(this.liquidator.address, isHFBelowThresholdCall).encodeABI();
	//
	//   const order = buildOrder(this.swap, this.weth, this.dai, collateralAmount, purchaseAmount, this.liquidator.address, zeroAddress, predicate);
	//   order.interaction = web3.eth.abi.encodeParameters(['address', 'address', 'address', 'uint256', 'bool'], [this.weth.address, this.dai.address, wallet, purchaseAmount, false]);
	//
	//   const signature = web3.eth.abi.encodeParameter(ABIOrder, order);
	//
	//   //approve takerAmount by taker
	//   await this.dai.approve(this.swap.address, purchaseAmount, {from: wallet});
	//
	//   await expectRevert(
	//     await this.swap.fillOrder(order, signature, collateralAmount, 0, purchaseAmount, {from: wallet}),
	//     'LOP: predicate returned false');
	// });

	// });
});
