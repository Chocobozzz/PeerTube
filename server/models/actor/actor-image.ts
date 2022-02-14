import { remove } from 'fs-extra'
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
import { MActorImageFormattable } from '@server/types/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { ActorImageType } from '@shared/models'
import { ActorImage } from '../../../shared/models/actors/actor-image.model'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { LAZY_STATIC_PATHS } from '../../initializers/constants'
import { throwIfNotValid } from '../utils'
import { ActorModel } from './actor'

@Table({
  tableName: 'actorImage',
  indexes: [
    {
      fields: [ 'filename' ],
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
  type: ActorImageType

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    as: 'Actor',
    onDelete: 'CASCADE'
  })
  Actor: ActorModel

  @AfterDestroy
  static removeFilesAndSendDelete (instance: ActorImageModel) {
    logger.info('Removing actor image file %s.', instance.filename)

    // Don't block the transaction
    instance.removeImage()
      .catch(err => logger.error('Cannot remove actor image file %s.', instance.filename, err))
  }

  static loadByName (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return ActorImageModel.findOne(query)
  }

  toFormattedJSON (this: MActorImageFormattable): ActorImage {
    return {
      width: this.width,
      path: this.getStaticPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  getStaticPath () {
    switch (this.type) {
      case ActorImageType.AVATAR:
        return join(LAZY_STATIC_PATHS.AVATARS, this.filename)
      default:
        return join(LAZY_STATIC_PATHS.BANNERS, this.filename)
    }
  }

  getPath () {
    return join(CONFIG.STORAGE.ACTOR_IMAGES, this.filename)
  }

  removeImage () {
    const imagePath = join(CONFIG.STORAGE.ACTOR_IMAGES, this.filename)
    return remove(imagePath)
  }

  isOwned () {
    return !this.fileUrl
  }
}
