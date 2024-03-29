import {
  AdminAbuse,
  CustomConfig,
  User,
  VideoChannel,
  VideoChannelSync,
  VideoComment,
  VideoDetails,
  VideoImport
} from '@peertube/peertube-models'
import { AUDIT_LOG_FILENAME } from '@server/initializers/constants.js'
import { diff } from 'deep-object-diff'
import express from 'express'
import { flatten } from 'flat'
import { join } from 'path'
import { addColors, config, createLogger, format, transports } from 'winston'
import { CONFIG } from '../initializers/config.js'
import { jsonLoggerFormat, labelFormatter } from './logger.js'

function getAuditIdFromRes (res: express.Response) {
  return res.locals.oauth.token.User.username
}

enum AUDIT_TYPE {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

const colors = config.npm.colors
colors.audit = config.npm.colors.info

addColors(colors)

const auditLogger = createLogger({
  levels: { audit: 0 },
  transports: [
    new transports.File({
      filename: join(CONFIG.STORAGE.LOG_DIR, AUDIT_LOG_FILENAME),
      level: 'audit',
      maxsize: 5242880,
      maxFiles: 5,
      format: format.combine(
        format.timestamp(),
        labelFormatter(),
        format.splat(),
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
  constructor (private readonly keysToKeep: Set<string>, private readonly prefix: string, private readonly entityInfos: object) { }

  toLogKeys (): object {
    const obj = flatten<object, any>(this.entityInfos, { delimiter: '-', safe: true })

    return Object.keys(obj)
      .filter(key => this.keysToKeep.has(key))
      .reduce((p, k) => ({ ...p, [`${this.prefix}-${k}`]: obj[k] }), {})
  }
}

const videoKeysToKeep = new Set([
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
  'commentsPolicy',
  'downloadEnabled'
])
class VideoAuditView extends EntityAuditView {
  constructor (video: VideoDetails) {
    super(videoKeysToKeep, 'video', video)
  }
}

const videoImportKeysToKeep = new Set([
  'id',
  'targetUrl',
  'video-name'
])
class VideoImportAuditView extends EntityAuditView {
  constructor (videoImport: VideoImport) {
    super(videoImportKeysToKeep, 'video-import', videoImport)
  }
}

const commentKeysToKeep = new Set([
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
])
class CommentAuditView extends EntityAuditView {
  constructor (comment: VideoComment) {
    super(commentKeysToKeep, 'comment', comment)
  }
}

const userKeysToKeep = new Set([
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
])
class UserAuditView extends EntityAuditView {
  constructor (user: User) {
    super(userKeysToKeep, 'user', user)
  }
}

const channelKeysToKeep = new Set([
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
])
class VideoChannelAuditView extends EntityAuditView {
  constructor (channel: VideoChannel) {
    super(channelKeysToKeep, 'channel', channel)
  }
}

const abuseKeysToKeep = new Set([
  'id',
  'reason',
  'reporterAccount',
  'createdAt'
])
class AbuseAuditView extends EntityAuditView {
  constructor (abuse: AdminAbuse) {
    super(abuseKeysToKeep, 'abuse', abuse)
  }
}

const customConfigKeysToKeep = new Set([
  'instance-name',
  'instance-shortDescription',
  'instance-description',
  'instance-terms',
  'instance-defaultClientRoute',
  'instance-defaultNSFWPolicy',
  'instance-customizations-javascript',
  'instance-customizations-css',
  'services-twitter-username',
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
])
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

const channelSyncKeysToKeep = new Set([
  'id',
  'externalChannelUrl',
  'channel-id',
  'channel-name'
])
class VideoChannelSyncAuditView extends EntityAuditView {
  constructor (channelSync: VideoChannelSync) {
    super(channelSyncKeysToKeep, 'channelSync', channelSync)
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
  CustomConfigAuditView,
  VideoChannelSyncAuditView
}
