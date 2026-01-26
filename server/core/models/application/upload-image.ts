import { type UploadImageType_Type } from '@peertube/peertube-models'
import { MActorId, MUploadImage } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Transaction } from 'sequelize'
import { AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { logger } from '../../helpers/logger.js'
import { DIRECTORIES, STATIC_PATHS, WEBSERVER } from '../../initializers/constants.js'
import { ActorModel } from '../actor/actor.js'
import { SequelizeModel } from '../shared/index.js'

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

  @AllowNull(true)
  @Column
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
  static removeFile (instance: UploadImageModel) {
    logger.info('Removing upload image file %s.', instance.filename)

    // Don't block the transaction
    instance.removeImage()
      .catch(err => logger.error('Cannot remove upload image file %s.', instance.filename, { err }))
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

  static getImageUrl (image: MUploadImage) {
    if (!image) return undefined

    return WEBSERVER.URL + image.getStaticPath()
  }

  static getPathOf (filename: string) {
    return join(DIRECTORIES.UPLOAD_IMAGES, filename)
  }

  // ---------------------------------------------------------------------------

  getStaticPath (this: MUploadImage) {
    return join(STATIC_PATHS.UPLOAD_IMAGES, this.filename)
  }

  getPath () {
    return UploadImageModel.getPathOf(this.filename)
  }

  removeImage () {
    return remove(this.getPath())
  }

  isLocal () {
    return !this.fileUrl
  }
}
