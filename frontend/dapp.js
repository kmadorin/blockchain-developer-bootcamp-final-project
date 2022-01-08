function run() {
	const metamaskEl = document.getElementById('metamask');

	if (window.ethereum) {
		metamaskEl.textContent = "Metamask detected";
	}
}

document.addEventListener("DOMContentLoaded", run);