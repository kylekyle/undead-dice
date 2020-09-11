const path = require('path');

module.exports = {
	devServer: {
		// inline: false,
		disableHostCheck: true,
		contentBase: '../public/',
		publicPath: '/js/',
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
			"Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
		}
	},	
	output: {
		filename: 'undead-dice.min.js',
		path: path.resolve(__dirname, '../public/js/'),
	},
};
