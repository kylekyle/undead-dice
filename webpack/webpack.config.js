const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	devServer: {
		disableHostCheck: true,
		contentBase: '../public/',
		publicPath: '/js/',
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
			"Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
		}
	},
	plugins: [
		new CopyPlugin({
			patterns: [{ 
				to: '../css/', 
				from: 'node_modules/bootstrap/dist/css/bootstrap.min.css'
			}]
		})
	],
	output: {
		filename: '[name].min.js',
		path: path.resolve(__dirname, '../public/js/'),
	},
	entry: {
    'game': path.resolve(__dirname, 'src/game.js'),
    'home': path.resolve(__dirname, 'src/home.js')
	}
};
