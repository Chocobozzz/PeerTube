import { join } from 'path'
import { AfterDestroy, AllowNull, Column, CreatedAt, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { CONFIG, STATIC_PATHS } from '../../initializers'
import { logger } from '../../helpers/logger'
import { remove } from 'fs-extra'

@Table({
  tableName: 'avatar'
})
export class AvatarModel extends Model<AvatarModel> {

  @AllowNull(false)
  @Column
  filename: string

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

  toFormattedJSON (): Avatar {
    return {
      path: this.getWebserverPath(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  getWebserverPath () {
    return join(STATIC_PATHS.AVATARS, this.filename)
  }

  removeAvatar () {
    const avatarPath = join(CONFIG.STORAGE.AVATARS_DIR, this.filename)
    return remove(avatarPath)
  }
}
