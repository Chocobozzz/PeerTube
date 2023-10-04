import { ActivityIconObject, ActorImage, ActorImageType, type ActorImageType_Type } from '@peertube/peertube-models'
import { getLowercaseExtension } from '@peertube/peertube-node-utils'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { MActorImage, MActorImageFormattable } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { LAZY_STATIC_PATHS, MIMETYPES, WEBSERVER } from '../../initializers/constants.js'
import { buildSQLAttributes, throwIfNotValid } from '../shared/index.js'
import { ActorModel } from './actor.js'

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
export class ActorImageModel extends Model<Partial<AttributesOnly<ActorImageModel>>> {

  @AllowNull(false)
  @Column
  filename: string

  @AllowNull(true)
  @Default(null)
  @Column
  height: number

  @AllowNull(true)
  @Default(null)
  @Column
  width: number

  @AllowNull(true)
  @Is('ActorImageFileUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'fileUrl', true))
  @Column
  fileUrl: string

  @AllowNull(false)
  @Column
  onDisk: boolean

  @AllowNull(false)
  @Column
  type: ActorImageType_Type

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Actor: Awaited<ActorModel> // Remove awaited: https://github.com/sequelize/sequelize-typescript/issues/825

  @AfterDestroy
  static removeFilesAndSendDelete (instance: ActorImageModel) {
    logger.info('Removing actor image file %s.', instance.filename)

    // Don't block the transaction
    instance.removeImage()
      .catch(err => logger.error('Cannot remove actor image file %s.', instance.filename, { err }))
  }

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static loadByName (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return ActorImageModel.findOne(query)
  }

  static getImageUrl (image: MActorImage) {
    if (!image) return undefined

    return WEBSERVER.URL + image.getStaticPath()
  }

  toFormattedJSON (this: MActorImageFormattable): ActorImage {
    return {
      width: this.width,
      path: this.getStaticPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toActivityPubObject (): ActivityIconObject {
    const extension = getLowercaseExtension(this.filename)

    return {
      type: 'Image',
      mediaType: MIMETYPES.IMAGE.EXT_MIMETYPE[extension],
      height: this.height,
      width: this.width,
      url: ActorImageModel.getImageUrl(this)
    }
  }

  getStaticPath () {
    switch (this.type) {
      case ActorImageType.AVATAR:
        return join(LAZY_STATIC_PATHS.AVATARS, this.filename)

      case ActorImageType.BANNER:
        return join(LAZY_STATIC_PATHS.BANNERS, this.filename)

      default:
        throw new Error('Unknown actor image type: ' + this.type)
    }
  }

  getPath () {
    return join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, this.filename)
  }

  removeImage () {
    const imagePath = join(CONFIG.STORAGE.ACTOR_IMAGES_DIR, this.filename)
    return remove(imagePath)
  }

  isOwned () {
    return !this.fileUrl
  }
}
