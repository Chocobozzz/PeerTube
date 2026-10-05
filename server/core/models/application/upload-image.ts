import { FileStorage, type FileStorageType, type UploadImageType_Type } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { buildCommonFileObjectStorageUrl, removeCommonFileObjectStorage } from '@server/lib/object-storage/common-files.js'
import { MActorId, MUploadImage } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Op, Transaction } from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { createLogger } from '../../helpers/logger.js'
import { CONSTRAINTS_FIELDS, DIRECTORIES, STATIC_PATHS, WEBSERVER } from '../../initializers/constants.js'
import { ActorModel } from '../actor/actor.js'
import { SequelizeModel, doesExist } from '../shared/index.js'

const logger = createLogger()

// Image uploads that are not suitable for other tables actor images (avatars/banners)
// Can be used to store instance images like logos, favicons, etc.

@Table({
  tableName: 'uploadImage',
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
export class UploadImageModel extends SequelizeModel<UploadImageModel> {
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
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  declare fileUrl: string

  @AllowNull(false)
  @Column
  declare type: UploadImageType_Type

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
  declare Actor: Awaited<ActorModel>

  @AfterDestroy
  static removeFile (instance: UploadImageModel, options: { transaction?: Transaction }) {
    // Keep the file if the transaction is rolled back
    afterCommitIfTransaction(options.transaction, () => {
      logger.info('Removing upload image file %s.', instance.filename)

      // Don't block the caller
      instance.removeImage()
        .catch(err => logger.error('Cannot remove upload image file %s.', instance.filename, { err }))
    })
  }

  static listByActor (actor: MActorId, transaction: Transaction) {
    const query = {
      where: {
        actorId: actor.id
      },
      transaction
    }

    return UploadImageModel.findAll(query)
  }

  static listByActorAndType (actor: MActorId, type: UploadImageType_Type, transaction: Transaction) {
    const query = {
      where: {
        actorId: actor.id,
        type
      },
      transaction
    }

    return UploadImageModel.findAll(query)
  }

  static loadByFilename (filename: string) {
    const query = {
      where: { filename }
    }

    return UploadImageModel.findOne(query)
  }

  // Local images that are not on the target storage yet
  static async listLocalIdsToMove (targetStorage: FileStorageType) {
    const rows = await UploadImageModel.findAll({
      attributes: [ 'id' ],
      where: {
        fileUrl: null,
        storage: {
          [Op.ne]: targetStorage
        }
      }
    })

    return rows.map(r => r.id)
  }

  static doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "uploadImage" ' +
      `WHERE "filename" = $filename AND "storage" = $storage AND "fileUrl" IS NULL LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // Don't update an image that has been replaced or moved in the meantime
  static async updateStorageIfUnchanged (filename: string, from: FileStorageType, to: FileStorageType) {
    const [ affectedCount ] = await UploadImageModel.update(
      { storage: to },
      { where: { filename, storage: from, fileUrl: null } }
    )

    return affectedCount !== 0
  }

  // ---------------------------------------------------------------------------

  static getFSPathOf (filename: string) {
    return join(DIRECTORIES.UPLOAD_IMAGES, filename)
  }

  // ---------------------------------------------------------------------------

  getLocalFileUrl (this: MUploadImage) {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) {
      return buildCommonFileObjectStorageUrl('uploads', this.filename)
    }

    // Remote files are cached by our instance
    return WEBSERVER.URL + join(STATIC_PATHS.UPLOAD_IMAGES, this.filename)
  }

  getFSPath () {
    return UploadImageModel.getFSPathOf(this.filename)
  }

  removeImage (this: MUploadImage) {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) {
      logger.info('Removing upload image file %s from object storage', this.filename)

      return removeCommonFileObjectStorage('uploads', this.filename)
    }

    return remove(this.getFSPath())
  }

  isLocal () {
    return !this.fileUrl
  }
}
