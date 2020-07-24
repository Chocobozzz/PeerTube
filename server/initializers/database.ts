import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize as SequelizeTypescript } from 'sequelize-typescript'
import { AbuseModel } from '@server/models/abuse/abuse'
import { AbuseMessageModel } from '@server/models/abuse/abuse-message'
import { VideoAbuseModel } from '@server/models/abuse/video-abuse'
import { VideoCommentAbuseModel } from '@server/models/abuse/video-comment-abuse'
import { isTestInstance } from '../helpers/core-utils'
import { logger } from '../helpers/logger'
import { AccountModel } from '../models/account/account'
import { AccountBlocklistModel } from '../models/account/account-blocklist'
import { AccountVideoRateModel } from '../models/account/account-video-rate'
import { UserModel } from '../models/account/user'
import { UserNotificationModel } from '../models/account/user-notification'
import { UserNotificationSettingModel } from '../models/account/user-notification-setting'
import { UserVideoHistoryModel } from '../models/account/user-video-history'
import { ActorModel } from '../models/activitypub/actor'
import { ActorFollowModel } from '../models/activitypub/actor-follow'
import { ApplicationModel } from '../models/application/application'
import { AvatarModel } from '../models/avatar/avatar'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { OAuthTokenModel } from '../models/oauth/oauth-token'
import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { PluginModel } from '../models/server/plugin'
import { ServerModel } from '../models/server/server'
import { ServerBlocklistModel } from '../models/server/server-blocklist'
import { ScheduleVideoUpdateModel } from '../models/video/schedule-video-update'
import { TagModel } from '../models/video/tag'
import { ThumbnailModel } from '../models/video/thumbnail'
import { VideoModel } from '../models/video/video'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import { VideoCaptionModel } from '../models/video/video-caption'
import { VideoChangeOwnershipModel } from '../models/video/video-change-ownership'
import { VideoChannelModel } from '../models/video/video-channel'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoFileModel } from '../models/video/video-file'
import { VideoImportModel } from '../models/video/video-import'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { VideoPlaylistElementModel } from '../models/video/video-playlist-element'
import { VideoShareModel } from '../models/video/video-share'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { VideoTagModel } from '../models/video/video-tag'
import { VideoViewModel } from '../models/video/video-view'
import { CONFIG } from './config'

require('pg').defaults.parseInt8 = true // Avoid BIGINT to be converted to string

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD
const host = CONFIG.DATABASE.HOSTNAME
const port = CONFIG.DATABASE.PORT
const poolMax = CONFIG.DATABASE.POOL.MAX

const sequelizeTypescript = new SequelizeTypescript({
  database: dbname,
  dialect: 'postgres',
  host,
  port,
  username,
  password,
  pool: {
    max: poolMax
  },
  benchmark: isTestInstance(),
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  logging: (message: string, benchmark: number) => {
    if (process.env.NODE_DB_LOG === 'false') return

    let newMessage = message
    if (isTestInstance() === true && benchmark !== undefined) {
      newMessage += ' | ' + benchmark + 'ms'
    }

    logger.debug(newMessage)
  }
})

async function initDatabaseModels (silent: boolean) {
  sequelizeTypescript.addModels([
    ApplicationModel,
    ActorModel,
    ActorFollowModel,
    AvatarModel,
    AccountModel,
    OAuthClientModel,
    OAuthTokenModel,
    ServerModel,
    TagModel,
    AccountVideoRateModel,
    UserModel,
    AbuseMessageModel,
    AbuseModel,
    VideoCommentAbuseModel,
    VideoAbuseModel,
    VideoModel,
    VideoChangeOwnershipModel,
    VideoChannelModel,
    VideoShareModel,
    VideoFileModel,
    VideoCaptionModel,
    VideoBlacklistModel,
    VideoTagModel,
    VideoCommentModel,
    ScheduleVideoUpdateModel,
    VideoImportModel,
    VideoViewModel,
    VideoRedundancyModel,
    UserVideoHistoryModel,
    AccountBlocklistModel,
    ServerBlocklistModel,
    UserNotificationModel,
    UserNotificationSettingModel,
    VideoStreamingPlaylistModel,
    VideoPlaylistModel,
    VideoPlaylistElementModel,
    ThumbnailModel,
    PluginModel
  ])

  // Check extensions exist in the database
  await checkPostgresExtensions()

  // Create custom PostgreSQL functions
  await createFunctions()

  if (!silent) logger.info('Database %s is ready.', dbname)
}

// ---------------------------------------------------------------------------

export {
  initDatabaseModels,
  sequelizeTypescript
}

// ---------------------------------------------------------------------------

async function checkPostgresExtensions () {
  const promises = [
    checkPostgresExtension('pg_trgm'),
    checkPostgresExtension('unaccent')
  ]

  return Promise.all(promises)
}

async function checkPostgresExtension (extension: string) {
  const query = `SELECT 1 FROM pg_available_extensions WHERE name = '${extension}' AND installed_version IS NOT NULL;`
  const options = {
    type: QueryTypes.SELECT as QueryTypes.SELECT,
    raw: true
  }

  const res = await sequelizeTypescript.query<object>(query, options)

  if (!res || res.length === 0) {
    // Try to create the extension ourselves
    try {
      await sequelizeTypescript.query(`CREATE EXTENSION ${extension};`, { raw: true })

    } catch {
      const errorMessage = `You need to enable ${extension} extension in PostgreSQL. ` +
        `You can do so by running 'CREATE EXTENSION ${extension};' as a PostgreSQL super user in ${CONFIG.DATABASE.DBNAME} database.`
      throw new Error(errorMessage)
    }
  }
}

function createFunctions () {
  const query = `CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS
$func$
SELECT public.unaccent('public.unaccent', $1::text)
$func$  LANGUAGE sql IMMUTABLE;`

  return sequelizeTypescript.query(query, { raw: true })
}
