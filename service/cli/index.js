'use strict';

const getAavePositions = require(`./getAavePositions`);
const getAndParseAavePositions = require(`./getAndParseAavePositions`);
const getFilteredAavePositions = require(`./getFilteredAavePositions`);
const help = require(`./help`);

const Cli = {
	[getAavePositions.name]: getAavePositions,
	[getAndParseAavePositions.name]: getAndParseAavePositions,
	[getFilteredAavePositions.name]: getFilteredAavePositions,
	[help.name]: help,
};

module.exports = {
	Cli,
};
