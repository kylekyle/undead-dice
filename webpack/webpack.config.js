const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	devServer: {
		injectClient: false,
		disableHostCheck: true,
		contentBase: '../public/',
		publicPath: '/js/'
	},
	plugins: [
		new CopyPlugin({
			patterns: [{ 
				to: '../css/', 
				from: 'node_modules/bootstrap/dist/css/bootstrap.min.css'
			}]
		}),
		new webpack.ProvidePlugin({
			$: 'jquery',
			jQuery: 'jquery',
			THREE: 'three',
			CANNON: 'cannon'
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
