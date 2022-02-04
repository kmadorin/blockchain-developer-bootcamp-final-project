'use strict';

const chalk = require(`chalk`);

module.exports = {
	name: `--help`,
	run(args) {
		console.log(`###: args`, args);
		const text = `
    The program allows to work with Aave positions and create 1inch limit orders to protect or liquidate a position

    Guide:
      service.js <command>

      Commands:

      --help:               						 prints this text
      --getAavePositions <Aave version> <network> :  gets and lists all Aave users from the Graph and prints it to console
    `;

		console.log(chalk.gray(text));
	}
};
