import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.renameTable('Applications', 'application')
  await utils.queryInterface.renameTable('AccountFollows', 'accountFollow')
  await utils.queryInterface.renameTable('AccountVideoRates', 'accountVideoRate')
  await utils.queryInterface.renameTable('Accounts', 'account')
  await utils.queryInterface.renameTable('Avatars', 'avatar')
  await utils.queryInterface.renameTable('BlacklistedVideos', 'videoBlacklist')
  await utils.queryInterface.renameTable('Jobs', 'job')
  await utils.queryInterface.renameTable('OAuthClients', 'oAuthClient')
  await utils.queryInterface.renameTable('OAuthTokens', 'oAuthToken')
  await utils.queryInterface.renameTable('Servers', 'server')
  await utils.queryInterface.renameTable('Tags', 'tag')
  await utils.queryInterface.renameTable('Users', 'user')
  await utils.queryInterface.renameTable('VideoAbuses', 'videoAbuse')
  await utils.queryInterface.renameTable('VideoChannels', 'videoChannel')
  await utils.queryInterface.renameTable('VideoChannelShares', 'videoChannelShare')
  await utils.queryInterface.renameTable('VideoFiles', 'videoFile')
  await utils.queryInterface.renameTable('VideoShares', 'videoShare')
  await utils.queryInterface.renameTable('VideoTags', 'videoTag')
  await utils.queryInterface.renameTable('Videos', 'video')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
