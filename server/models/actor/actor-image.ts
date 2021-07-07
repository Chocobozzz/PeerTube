import { remove } from 'fs-extra'
import { join } from 'path'
import { AfterDestroy, AllowNull, Column, CreatedAt, Default, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { MActorImageFormattable } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import { ActorImageType } from '@shared/models'
import { ActorImage } from '../../../shared/models/actors/actor-image.model'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { LAZY_STATIC_PATHS } from '../../initializers/constants'
import { throwIfNotValid } from '../utils'

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
      path: this.getStaticPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  getStaticPath () {
    if (this.type === ActorImageType.AVATAR) {
      return join(LAZY_STATIC_PATHS.AVATARS, this.filename)
    }

    return join(LAZY_STATIC_PATHS.BANNERS, this.filename)
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
