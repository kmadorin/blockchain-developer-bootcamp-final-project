const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
	mode: 'development',
	devServer: {
		static: './dist',
	},
	entry: './src/dapp.js',
	output: {
		filename: 'dapp.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	resolve: {
		fallback: {
			"http": require.resolve("stream-http")
		}
	},
	plugins: [
		new NodePolyfillPlugin()
	],
}
