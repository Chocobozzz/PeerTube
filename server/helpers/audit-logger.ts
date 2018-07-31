import * as path from 'path'
import { diff } from 'deep-object-diff'
import { chain } from 'lodash'
import * as flatten from 'flat'
import * as winston from 'winston'
import { CONFIG } from '../initializers'
import { jsonLoggerFormat, labelFormatter } from './logger'
import { VideoDetails } from '../../shared'

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
      filename: path.join(CONFIG.STORAGE.LOG_DIR, 'peertube-audit.log'),
      level: 'audit',
      maxsize: 5242880,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        labelFormatter,
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
  constructor (private keysToKeep: Array<string>, private prefix: string, private entityInfos: object) { }
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
  'commentsEnabled'
]
class VideoAuditView extends AuditEntity {
  constructor (private video: VideoDetails) {
    super(videoKeysToKeep, 'video', video)
  }
}

export {
  auditLoggerFactory,
  VideoAuditView
}
