import { join } from 'path'
import { AfterDestroy, AllowNull, Column, CreatedAt, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { unlinkPromise } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { CONFIG, STATIC_PATHS } from '../../initializers'
import { sendDeleteVideo } from '../../lib/activitypub/send'

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
    return instance.removeAvatar()
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
    return unlinkPromise(avatarPath)
  }
}
