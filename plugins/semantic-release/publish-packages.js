const verifyConditions = require('@semantic-release/npm').verifyConditions;
const prepareNpm = require('@semantic-release/npm').prepare;
const addChannelNpm = require('@semantic-release/npm').addChannel;
const publishNpm = require('@semantic-release/npm').publish;
const fs = require('fs');

async function verify(pluginConfig, context) {
	for (let config of pluginConfig.packages) {
		await verifyConditions(config, context);
	}
}

async function prepare(pluginConfig, context) {
	for (let config of pluginConfig.packages) {
		context.logger.log('HEHEHEHEY ' + JSON.stringify(fs.readdirSync('dist')));
		context.logger.log('HEHEHEHEY ' + JSON.stringify(fs.readdirSync('dist/apps')));
		context.logger.log('HEHEHEHEY ' + JSON.stringify(fs.readdirSync('dist/libs')));
		context.logger.log('HEHEHEHEY ' + JSON.stringify(fs.readdirSync('dist/libs/add')));
		await prepareNpm(config, context);
	}
}

async function addChannel(pluginConfig, context) {
	for (let config of pluginConfig.packages) {
		await addChannelNpm(config, context);
	}
}

async function publish(pluginConfig, context) {
	for (let config of pluginConfig.packages) {
		await publishNpm(config, context);
	}
}

module.exports = { verify, prepare, addChannel, publish };
