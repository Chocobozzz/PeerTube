import { join } from 'path'
import { AfterDestroy, AllowNull, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { LAZY_STATIC_PATHS } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { remove } from 'fs-extra'
import { CONFIG } from '../../initializers/config'
import { throwIfNotValid } from '../utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { MAvatarFormattable } from '@server/types/models'

@Table({
  tableName: 'avatar',
  indexes: [
    {
      fields: [ 'filename' ],
      unique: true
    }
  ]
})
export class AvatarModel extends Model<AvatarModel> {

  @AllowNull(false)
  @Column
  filename: string

  @AllowNull(true)
  @Is('AvatarFileUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'fileUrl', true))
  @Column
  fileUrl: string

  @AllowNull(false)
  @Column
  onDisk: boolean

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AfterDestroy
  static removeFilesAndSendDelete (instance: AvatarModel) {
    logger.info('Removing avatar file %s.', instance.filename)

    // Don't block the transaction
    instance.removeAvatar()
      .catch(err => logger.error('Cannot remove avatar file %s.', instance.filename, err))
  }

  static loadByName (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return AvatarModel.findOne(query)
  }

  toFormattedJSON (this: MAvatarFormattable): Avatar {
    return {
      path: this.getStaticPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  getStaticPath () {
    return join(LAZY_STATIC_PATHS.AVATARS, this.filename)
  }

  getPath () {
    return join(CONFIG.STORAGE.AVATARS_DIR, this.filename)
  }

  removeAvatar () {
    const avatarPath = join(CONFIG.STORAGE.AVATARS_DIR, this.filename)
    return remove(avatarPath)
  }
}
