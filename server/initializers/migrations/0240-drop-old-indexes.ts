import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {

  const indexNames = [
    'accounts_application_id',
    'accounts_user_id',
    'accounts_name',

    'account_video_rates_video_id_account_id',
    'account_video_rates_video_id_account_id_type',

    'account_follows_account_id_target_account_id',
    'account_follow_account_id_target_account_id',
    'account_follow_account_id',
    'account_follow_target_account_id',
    'account_follows_account_id',
    'account_follows_target_account_id',

    'o_auth_clients_client_id',
    'o_auth_clients_client_id_client_secret',

    'o_auth_tokens_access_token',
    'o_auth_tokens_refresh_token',
    'o_auth_tokens_o_auth_client_id',
    'o_auth_tokens_user_id',

    'pods_host',
    'servers_host',

    'tags_name',

    'users_email',
    'users_username',

    'videos_channel_id',
    'videos_created_at',
    'videos_duration',
    'videos_likes',
    'videos_name',
    'videos_uuid',
    'videos_views',

    'video_abuses_reporter_account_id',
    'video_abuses_video_id',

    'blacklisted_videos_video_id',

    'video_channels_account_id',

    'video_files_info_hash',
    'video_files_video_id',

    'video_shares_account_id',
    'video_shares_video_id',

    'video_tags_tag_id',
    'video_tags_video_id'
  ]

  for (const indexName of indexNames) {
    await utils.sequelize.query('DROP INDEX IF EXISTS "' + indexName + '";')
  }

  await utils.sequelize.query('ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "actorId_foreign_idx";')
  await utils.sequelize.query('ALTER TABLE "videoChannel" DROP CONSTRAINT IF EXISTS "actorId_foreign_idx";')
  await utils.sequelize.query('ALTER TABLE "videoShare" DROP CONSTRAINT IF EXISTS "VideoShares_videoId_fkey";')

  await utils.sequelize.query('DROP TABLE IF EXISTS "videoChannelShare";')
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
