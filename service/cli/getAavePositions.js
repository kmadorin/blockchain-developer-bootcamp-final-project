require('isomorphic-fetch');
const {getAavePositions} = require('../utils/aaveUtils');

module.exports = {
	name: `--getAavePositions`,
	async run(args) {
		try {
			console.log(`###: args`, args);
			const [version, network] = args;
			const positions = await getAavePositions(version, network);
			console.log(`###: positions`, positions);
		} catch (err) {
			console.log(`###: err`, err);
		}
	}
};
