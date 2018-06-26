import { Sequelize as SequelizeTypescript } from 'sequelize-typescript'
import { isTestInstance } from '../helpers/core-utils'
import { logger } from '../helpers/logger'

import { AccountModel } from '../models/account/account'
import { AccountVideoRateModel } from '../models/account/account-video-rate'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { ActorFollowModel } from '../models/activitypub/actor-follow'
import { ApplicationModel } from '../models/application/application'
import { AvatarModel } from '../models/avatar/avatar'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { OAuthTokenModel } from '../models/oauth/oauth-token'
import { ServerModel } from '../models/server/server'
import { TagModel } from '../models/video/tag'
import { VideoModel } from '../models/video/video'
import { VideoAbuseModel } from '../models/video/video-abuse'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import { VideoChannelModel } from '../models/video/video-channel'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoFileModel } from '../models/video/video-file'
import { VideoShareModel } from '../models/video/video-share'
import { VideoTagModel } from '../models/video/video-tag'
import { CONFIG } from './constants'
import { ScheduleVideoUpdateModel } from '../models/video/schedule-video-update'

require('pg').defaults.parseInt8 = true // Avoid BIGINT to be converted to string

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD
const host = CONFIG.DATABASE.HOSTNAME
const port = CONFIG.DATABASE.PORT

const sequelizeTypescript = new SequelizeTypescript({
  database: dbname,
  dialect: 'postgres',
  host,
  port,
  username,
  password,
  benchmark: isTestInstance(),
  isolationLevel: SequelizeTypescript.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  operatorsAliases: false,
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
    VideoAbuseModel,
    VideoChannelModel,
    VideoShareModel,
    VideoFileModel,
    VideoBlacklistModel,
    VideoTagModel,
    VideoModel,
    VideoCommentModel,
    ScheduleVideoUpdateModel
  ])

  if (!silent) logger.info('Database %s is ready.', dbname)

  return
}

// ---------------------------------------------------------------------------

export {
  initDatabaseModels,
  sequelizeTypescript
}
