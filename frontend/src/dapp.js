import Web3 from "./web3.min";
import LendingPoolABI from "./abis/LendingPool.json";
import LendingPoolAddressProviderABI from "./abis/ILendingPoolAddressProvider.json";

import positions from "./positions.json";

function Inchi() {
	const aaveLendingPoolAddressProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';

	const metamaskEl = document.getElementById('metamask');
	const metamaskBtn = document.getElementById('metamask-btn');
	const userAddressEl = document.getElementById('metamask-address')
	let userAddress = '0x';
	let metamaskAvailable = false;
	let web3 = undefined;

	function checkMetamask() {
		if (metamaskEl && window.ethereum && window.ethereum.isMetaMask) {
			metamaskEl.textContent = "Metamask detected";
			metamaskAvailable = true;
			web3 = new Web3(window.ethereum);
		} else {
			metamaskEl.textContent = "Metamask is not detected or not active"
			console.log(`###: metamaskBtn`, metamaskBtn);
			metamaskBtn.style.display = "none";
		}
	}

	function connectWallet() {
		metamaskBtn.disabled = true;
		window.ethereum.request({ method: 'eth_requestAccounts'})
			.then((accounts) => {
				userAddress = accounts[0];
				userAddressEl.textContent = userAddress;
			})
			.finally(() => metamaskBtn.disabled = false);
	}

	function renderPositionsToLiquidate(positions) {

	}

	function getPositionsToLiquidate() {
		console.log(`###: positions`, positions);
		const positionsMarkup = positions.map(position => {
			return `div`
		});
	}

	function init() {
		checkMetamask();
		metamaskAvailable && metamaskBtn.addEventListener('click', connectWallet);
		getPositionsToLiquidate();
	}

	this.init = init;
}


document.addEventListener("DOMContentLoaded", (new Inchi()).init());
