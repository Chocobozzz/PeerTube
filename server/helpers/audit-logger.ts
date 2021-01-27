import { diff } from 'deep-object-diff'
import * as express from 'express'
import * as flatten from 'flat'
import { chain } from 'lodash'
import * as path from 'path'
import * as winston from 'winston'
import { AUDIT_LOG_FILENAME } from '@server/initializers/constants'
import { AdminAbuse, User, VideoChannel, VideoDetails, VideoImport } from '../../shared'
import { CustomConfig } from '../../shared/models/server/custom-config.model'
import { VideoComment } from '../../shared/models/videos/video-comment.model'
import { CONFIG } from '../initializers/config'
import { jsonLoggerFormat, labelFormatter } from './logger'

function getAuditIdFromRes (res: express.Response) {
  return res.locals.oauth.token.User.username
}

enum AUDIT_TYPE {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

const colors = winston.config.npm.colors
colors.audit = winston.config.npm.colors.info

winston.addColors(colors)

const auditLogger = winston.createLogger({
  levels: { audit: 0 },
  transports: [
    new winston.transports.File({
      filename: path.join(CONFIG.STORAGE.LOG_DIR, AUDIT_LOG_FILENAME),
      level: 'audit',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        labelFormatter(),
        winston.format.splat(),
        jsonLoggerFormat
      )
    })
  ],
  exitOnError: true
})

function auditLoggerWrapper (domain: string, user: string, action: AUDIT_TYPE, entity: EntityAuditView, oldEntity: EntityAuditView = null) {
  let entityInfos: object
  if (action === AUDIT_TYPE.UPDATE && oldEntity) {
    const oldEntityKeys = oldEntity.toLogKeys()
    const diffObject = diff(oldEntityKeys, entity.toLogKeys())
    const diffKeys = Object.entries(diffObject).reduce((newKeys, entry) => {
      newKeys[`new-${entry[0]}`] = entry[1]
      return newKeys
    }, {})
    entityInfos = { ...oldEntityKeys, ...diffKeys }
  } else {
    entityInfos = { ...entity.toLogKeys() }
  }
  auditLogger.log('audit', JSON.stringify({
    user,
    domain,
    action,
    ...entityInfos
  }))
}

function auditLoggerFactory (domain: string) {
  return {
    create (user: string, entity: EntityAuditView) {
      auditLoggerWrapper(domain, user, AUDIT_TYPE.CREATE, entity)
    },
    update (user: string, entity: EntityAuditView, oldEntity: EntityAuditView) {
      auditLoggerWrapper(domain, user, AUDIT_TYPE.UPDATE, entity, oldEntity)
    },
    delete (user: string, entity: EntityAuditView) {
      auditLoggerWrapper(domain, user, AUDIT_TYPE.DELETE, entity)
    }
  }
}

abstract class EntityAuditView {
  constructor (private readonly keysToKeep: string[], private readonly prefix: string, private readonly entityInfos: object) { }

  toLogKeys (): object {
    return chain(flatten(this.entityInfos, { delimiter: '-', safe: true }))
      .pick(this.keysToKeep)
      .mapKeys((value, key) => `${this.prefix}-${key}`)
      .value()
  }
}

const videoKeysToKeep = [
  'tags',
  'uuid',
  'id',
  'uuid',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'category',
  'licence',
  'language',
  'privacy',
  'description',
  'duration',
  'isLocal',
  'name',
  'thumbnailPath',
  'previewPath',
  'nsfw',
  'waitTranscoding',
  'account-id',
  'account-uuid',
  'account-name',
  'channel-id',
  'channel-uuid',
  'channel-name',
  'support',
  'commentsEnabled',
  'downloadEnabled'
]
class VideoAuditView extends EntityAuditView {
  constructor (private readonly video: VideoDetails) {
    super(videoKeysToKeep, 'video', video)
  }
}

const videoImportKeysToKeep = [
  'id',
  'targetUrl',
  'video-name'
]
class VideoImportAuditView extends EntityAuditView {
  constructor (private readonly videoImport: VideoImport) {
    super(videoImportKeysToKeep, 'video-import', videoImport)
  }
}

const commentKeysToKeep = [
  'id',
  'text',
  'threadId',
  'inReplyToCommentId',
  'videoId',
  'createdAt',
  'updatedAt',
  'totalReplies',
  'account-id',
  'account-uuid',
  'account-name'
]
class CommentAuditView extends EntityAuditView {
  constructor (private readonly comment: VideoComment) {
    super(commentKeysToKeep, 'comment', comment)
  }
}

const userKeysToKeep = [
  'id',
  'username',
  'email',
  'nsfwPolicy',
  'autoPlayVideo',
  'role',
  'videoQuota',
  'createdAt',
  'account-id',
  'account-uuid',
  'account-name',
  'account-followingCount',
  'account-followersCount',
  'account-createdAt',
  'account-updatedAt',
  'account-avatar-path',
  'account-avatar-createdAt',
  'account-avatar-updatedAt',
  'account-displayName',
  'account-description',
  'videoChannels'
]
class UserAuditView extends EntityAuditView {
  constructor (private readonly user: User) {
    super(userKeysToKeep, 'user', user)
  }
}

const channelKeysToKeep = [
  'id',
  'uuid',
  'name',
  'followingCount',
  'followersCount',
  'createdAt',
  'updatedAt',
  'avatar-path',
  'avatar-createdAt',
  'avatar-updatedAt',
  'displayName',
  'description',
  'support',
  'isLocal',
  'ownerAccount-id',
  'ownerAccount-uuid',
  'ownerAccount-name',
  'ownerAccount-displayedName'
]
class VideoChannelAuditView extends EntityAuditView {
  constructor (private readonly channel: VideoChannel) {
    super(channelKeysToKeep, 'channel', channel)
  }
}

const abuseKeysToKeep = [
  'id',
  'reason',
  'reporterAccount',
  'createdAt'
]
class AbuseAuditView extends EntityAuditView {
  constructor (private readonly abuse: AdminAbuse) {
    super(abuseKeysToKeep, 'abuse', abuse)
  }
}

const customConfigKeysToKeep = [
  'instance-name',
  'instance-shortDescription',
  'instance-description',
  'instance-terms',
  'instance-defaultClientRoute',
  'instance-defaultNSFWPolicy',
  'instance-customizations-javascript',
  'instance-customizations-css',
  'services-twitter-username',
  'services-twitter-whitelisted',
  'cache-previews-size',
  'cache-captions-size',
  'signup-enabled',
  'signup-limit',
  'signup-requiresEmailVerification',
  'admin-email',
  'user-videoQuota',
  'transcoding-enabled',
  'transcoding-threads',
  'transcoding-resolutions'
]
class CustomConfigAuditView extends EntityAuditView {
  constructor (customConfig: CustomConfig) {
    const infos: any = customConfig
    const resolutionsDict = infos.transcoding.resolutions
    const resolutionsArray = []

    Object.entries(resolutionsDict)
          .forEach(([ resolution, isEnabled ]) => {
            if (isEnabled) resolutionsArray.push(resolution)
          })

    Object.assign({}, infos, { transcoding: { resolutions: resolutionsArray } })
    super(customConfigKeysToKeep, 'config', infos)
  }
}

export {
  getAuditIdFromRes,

  auditLoggerFactory,
  VideoImportAuditView,
  VideoChannelAuditView,
  CommentAuditView,
  UserAuditView,
  VideoAuditView,
  AbuseAuditView,
  CustomConfigAuditView
}
