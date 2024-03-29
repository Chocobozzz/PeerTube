import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { ActorCustomPageModel } from '@server/models/account/actor-custom-page.js'
import { AutomaticTagModel } from '@server/models/automatic-tag/automatic-tag.js'
import { VideoAutomaticTagModel } from '@server/models/automatic-tag/video-automatic-tag.js'
import { CommentAutomaticTagModel } from '@server/models/automatic-tag/comment-automatic-tag.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'
import { RunnerRegistrationTokenModel } from '@server/models/runner/runner-registration-token.js'
import { RunnerModel } from '@server/models/runner/runner.js'
import { TrackerModel } from '@server/models/server/tracker.js'
import { VideoTrackerModel } from '@server/models/server/video-tracker.js'
import { UserExportModel } from '@server/models/user/user-export.js'
import { UserImportModel } from '@server/models/user/user-import.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history.js'
import { UserModel } from '@server/models/user/user.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section.js'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import pg from 'pg'
import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize as SequelizeTypescript } from 'sequelize-typescript'
import { logger } from '../helpers/logger.js'
import { AbuseMessageModel } from '../models/abuse/abuse-message.js'
import { AbuseModel } from '../models/abuse/abuse.js'
import { VideoAbuseModel } from '../models/abuse/video-abuse.js'
import { VideoCommentAbuseModel } from '../models/abuse/video-comment-abuse.js'
import { AccountBlocklistModel } from '../models/account/account-blocklist.js'
import { AccountVideoRateModel } from '../models/account/account-video-rate.js'
import { AccountModel } from '../models/account/account.js'
import { ActorFollowModel } from '../models/actor/actor-follow.js'
import { ActorImageModel } from '../models/actor/actor-image.js'
import { ActorModel } from '../models/actor/actor.js'
import { ApplicationModel } from '../models/application/application.js'
import { OAuthClientModel } from '../models/oauth/oauth-client.js'
import { OAuthTokenModel } from '../models/oauth/oauth-token.js'
import { VideoRedundancyModel } from '../models/redundancy/video-redundancy.js'
import { PluginModel } from '../models/server/plugin.js'
import { ServerBlocklistModel } from '../models/server/server-blocklist.js'
import { ServerModel } from '../models/server/server.js'
import { UserNotificationSettingModel } from '../models/user/user-notification-setting.js'
import { ScheduleVideoUpdateModel } from '../models/video/schedule-video-update.js'
import { TagModel } from '../models/video/tag.js'
import { ThumbnailModel } from '../models/video/thumbnail.js'
import { VideoBlacklistModel } from '../models/video/video-blacklist.js'
import { VideoCaptionModel } from '../models/video/video-caption.js'
import { VideoChangeOwnershipModel } from '../models/video/video-change-ownership.js'
import { VideoChannelModel } from '../models/video/video-channel.js'
import { VideoCommentModel } from '../models/video/video-comment.js'
import { VideoFileModel } from '../models/video/video-file.js'
import { VideoImportModel } from '../models/video/video-import.js'
import { VideoLiveModel } from '../models/video/video-live.js'
import { VideoPlaylistElementModel } from '../models/video/video-playlist-element.js'
import { VideoPlaylistModel } from '../models/video/video-playlist.js'
import { VideoShareModel } from '../models/video/video-share.js'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist.js'
import { VideoTagModel } from '../models/video/video-tag.js'
import { VideoModel } from '../models/video/video.js'
import { VideoViewModel } from '../models/view/video-view.js'
import { CONFIG } from './config.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'

pg.defaults.parseInt8 = true // Avoid BIGINT to be converted to string

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD
const host = CONFIG.DATABASE.HOSTNAME
const port = CONFIG.DATABASE.PORT
const poolMax = CONFIG.DATABASE.POOL.MAX

let dialectOptions: any = {}

if (CONFIG.DATABASE.SSL) {
  dialectOptions = {
    ssl: {
      rejectUnauthorized: false
    }
  }
}

const sequelizeTypescript = new SequelizeTypescript({
  database: dbname,
  dialect: 'postgres',
  dialectOptions,
  host,
  port,
  username,
  password,
  pool: {
    max: poolMax
  },
  benchmark: isTestOrDevInstance(),
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  logging: (message: string, benchmark: number) => {
    if (process.env.NODE_DB_LOG === 'false') return

    let newMessage = 'Executed SQL request'
    if (isTestOrDevInstance() === true && benchmark !== undefined) {
      newMessage += ' in ' + benchmark + 'ms'
    }

    logger.debug(newMessage, { sql: message, tags: [ 'sql' ] })
  }
})

function checkDatabaseConnectionOrDie () {
  sequelizeTypescript.authenticate()
    .then(() => logger.debug('Connection to PostgreSQL has been established successfully.'))
    .catch(err => {

      logger.error('Unable to connect to PostgreSQL database.', { err })
      process.exit(-1)
    })
}

async function initDatabaseModels (silent: boolean) {
  sequelizeTypescript.addModels([
    ApplicationModel,
    ActorModel,
    ActorFollowModel,
    ActorImageModel,
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
    VideoSourceModel,
    VideoChapterModel,
    VideoCaptionModel,
    VideoBlacklistModel,
    VideoTagModel,
    VideoCommentModel,
    ScheduleVideoUpdateModel,
    VideoImportModel,
    VideoViewModel,
    VideoRedundancyModel,
    UserVideoHistoryModel,
    VideoLiveModel,
    VideoLiveSessionModel,
    VideoLiveReplaySettingModel,
    AccountBlocklistModel,
    ServerBlocklistModel,
    UserNotificationModel,
    UserNotificationSettingModel,
    VideoStreamingPlaylistModel,
    VideoPlaylistModel,
    VideoPlaylistElementModel,
    LocalVideoViewerModel,
    LocalVideoViewerWatchSectionModel,
    ThumbnailModel,
    TrackerModel,
    VideoTrackerModel,
    PluginModel,
    ActorCustomPageModel,
    UserImportModel,
    VideoJobInfoModel,
    VideoChannelSyncModel,
    UserRegistrationModel,
    VideoPasswordModel,
    RunnerRegistrationTokenModel,
    RunnerModel,
    RunnerJobModel,
    StoryboardModel,
    UserExportModel,
    VideoAutomaticTagModel,
    CommentAutomaticTagModel,
    AutomaticTagModel,
    WatchedWordsListModel,
    AccountAutomaticTagPolicyModel
  ])

  // Check extensions exist in the database
  await checkPostgresExtensions()

  // Create custom PostgreSQL functions
  await createFunctions()

  if (!silent) logger.info('Database %s is ready.', dbname)
}

// ---------------------------------------------------------------------------

export {
  checkDatabaseConnectionOrDie, initDatabaseModels, sequelizeTypescript
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
