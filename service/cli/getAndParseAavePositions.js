const {getAavePositions, parseAavePositions} = require('../utils/aaveUtils');

module.exports = {
	name: `--getAndParseAavePositions`,
	async run(args) {
		try {
			const [version, network] = args;
			const positions = await getAavePositions(version, network);
			const parsedAavePositions = parseAavePositions(positions);
			console.log(`###: positions`, parsedAavePositions);
		} catch (err) {
			console.log(`###: err`, err);
		}
	}
};
