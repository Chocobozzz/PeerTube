import {
  ActivityIconObject,
  ActorImage,
  ActorImageType,
  type ActorImageType_Type,
  FileStorage,
  type FileStorageType
} from '@peertube/peertube-models'
import { getLowercaseExtension } from '@peertube/peertube-node-utils'
import { buildCommonFileObjectStorageUrl, removeCommonFileObjectStorage } from '@server/lib/object-storage/common-files.js'
import { MActorId, MActorImage, MActorImageFormattable, MActorImagePath } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Op, Transaction } from 'sequelize'
import { AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { FILES_CACHE, LAZY_STATIC_PATHS, MIMETYPES, WEBSERVER } from '../../initializers/constants.js'
import { SequelizeModel, buildSQLAttributes, doesExist } from '../shared/index.js'
import { ActorModel } from './actor.js'

const logger = createLogger()

@Table({
  tableName: 'actorImage',
  indexes: [
    {
      fields: [ 'filename' ],
      unique: true
    },
    {
      fields: [ 'actorId', 'type', 'width' ],
      unique: true
    }
  ]
})
export class ActorImageModel extends SequelizeModel<ActorImageModel> {
  @AllowNull(false)
  @Column
  declare filename: string

  @AllowNull(true)
  @Default(null)
  @Column
  declare height: number

  @AllowNull(true)
  @Default(null)
  @Column
  declare width: number

  @AllowNull(false)
  @Default(FileStorage.FILE_SYSTEM)
  @Column
  declare storage: FileStorageType

  @AllowNull(true)
  @Column
  declare fileUrl: string

  @AllowNull(false)
  @Column
  declare cached: boolean

  @AllowNull(false)
  @Column
  declare type: ActorImageType_Type

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  declare actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Actor: Awaited<ActorModel> // TODO: Remove awaited: https://github.com/sequelize/sequelize-typescript/issues/825

  @AfterDestroy
  static removeFile (instance: ActorImageModel) {
    logger.info('Removing actor image file %s.', instance.filename)

    // Don't block the transaction
    instance.removeFile()
      .catch(err => logger.error('Cannot remove actor image file %s.', instance.filename, { err }))
  }

  // ---------------------------------------------------------------------------

  static getSQLAttributesJSON () {
    return buildSQLAttributes({
      model: this,
      tableName: '',
      aliasPrefix: '',
      jsonMode: true
    })
  }

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static loadByFilename (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return ActorImageModel.findOne(query)
  }

  static listByActor (actor: MActorId, type: ActorImageType_Type, transaction?: Transaction) {
    const query = {
      where: {
        actorId: actor.id,
        type
      },
      transaction
    }

    return ActorImageModel.findAll(query)
  }

  static async listActorImages (actor: MActorId, transaction?: Transaction) {
    const promises = [ ActorImageType.AVATAR, ActorImageType.BANNER ].map(type => ActorImageModel.listByActor(actor, type, transaction))

    const [ avatars, banners ] = await Promise.all(promises)

    return { avatars, banners }
  }

  static listRemoteCached () {
    return this.findAll<MActorImage>({
      where: {
        cached: true,
        fileUrl: {
          [Op.ne]: null
        }
      }
    })
  }

  // Actors that own local images that are not on the target storage yet
  static async listLocalActorIdsToMove (targetStorage: FileStorageType) {
    const rows = await this.findAll<MActorImage>({
      attributes: [ 'actorId' ],
      group: [ 'actorId' ],
      where: {
        fileUrl: null,
        storage: {
          [Op.ne]: targetStorage
        }
      },
      raw: true
    })

    return rows.map(r => r.actorId)
  }

  static doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "actorImage" ' +
      `WHERE "filename" = $filename AND "storage" = $storage AND "fileUrl" IS NULL LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // Don't update an actor image that has been replaced or moved in the meantime
  static async updateStorageIfUnchanged (filename: string, from: FileStorageType, to: FileStorageType) {
    const [ affectedCount ] = await ActorImageModel.update(
      { storage: to },
      { where: { filename, storage: from, fileUrl: null } }
    )

    return affectedCount !== 0
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MActorImageFormattable): ActorImage {
    return {
      height: this.height,
      width: this.width,
      path: this.getStaticPath(),
      fileUrl: this.getLocalFileUrl(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toActivityPubObject (): ActivityIconObject {
    return {
      type: 'Image',
      mediaType: this.getMimeType(),
      height: this.height,
      width: this.width,
      url: this.getLocalFileUrl()
    }
  }

  // ---------------------------------------------------------------------------

  getLocalFileUrl (this: MActorImagePath) {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) {
      return buildCommonFileObjectStorageUrl('avatars', this.filename)
    }

    // Remote files are cached by our instance
    return WEBSERVER.URL + this.getStaticPath()
  }

  // Returns null if the file is in object storage: it is not served by our instance
  getStaticPath (this: MActorImagePath) {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) return null

    switch (this.type) {
      case ActorImageType.AVATAR:
        return join(LAZY_STATIC_PATHS.AVATARS, this.filename)

      case ActorImageType.BANNER:
        return join(LAZY_STATIC_PATHS.BANNERS, this.filename)

      default:
        throw new Error('Unknown actor image type: ' + this.type)
    }
  }

  getFSPath () {
    return join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, this.filename)
  }

  getFSCachedPath () {
    return join(FILES_CACHE.AVATARS.DIRECTORY, this.filename)
  }

  removeFile (this: MActorImage) {
    if (!this.cached && this.storage === FileStorage.OBJECT_STORAGE) {
      logger.info('Removing actor image file %s from object storage', this.filename)

      return removeCommonFileObjectStorage('avatars', this.filename)
    }

    const path = this.cached
      ? this.getFSCachedPath()
      : this.getFSPath()

    logger.info('Removing actor image file ' + path)

    return remove(path)
  }

  isLocal () {
    return !this.fileUrl
  }

  getMimeType () {
    return MIMETYPES.IMAGE.EXT_MIMETYPE[getLowercaseExtension(this.filename)]
  }
}
