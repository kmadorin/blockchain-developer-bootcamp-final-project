const Inchi = artifacts.require("Inchi");

module.exports = function (deployer, network, accounts) {
	console.log(`###: accounts`, accounts)
	deployer.deploy(Inchi);
};
