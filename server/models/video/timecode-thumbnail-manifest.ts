import { join } from 'path'
import * as uuidv4 from 'uuid/v4'
import { AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { STATIC_PATHS, WEBSERVER } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { remove } from 'fs-extra'
import { CONFIG } from '../../initializers/config'
import { VideoModel } from './video'

/**
 * Used to store timecode thumbnail manifests (.vtt files listing thumbnails used
 * for video scrubbing previews)
 *
 * A video has zero or one manifest at most.
 */
@Table({
  tableName: 'timecodeThumbnailManifest',
  indexes: [
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class TimecodeThumbnailManifestModel extends Model<TimecodeThumbnailManifestModel> {

  @AllowNull(false)
  @Column
  filename: string

  @AllowNull(true)
  @Column
  fileUrl: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AfterDestroy
  static removeFiles (instance: TimecodeThumbnailManifestModel) {
    logger.info('Removing timecode thumbnail manifest file %s.', instance.filename)

    // Don't block the transaction
    instance.removeManifest()
            .catch(err => logger.error('Cannot remove timecode thumbnail manifest file %s.', instance.filename, err))
  }

  static loadByName (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return TimecodeThumbnailManifestModel.findOne(query)
  }

  static generateManifestName () {
    return uuidv4() + '.vtt'
  }

  getFileUrl () {
    if (this.fileUrl) return this.fileUrl

    const staticPath = STATIC_PATHS.THUMBNAILS
    return WEBSERVER.URL + staticPath + this.filename
  }

  getPath () {
    const directory = CONFIG.STORAGE.THUMBNAILS_DIR
    return join(directory, this.filename)
  }

  removeManifest () {
    return remove(this.getPath())
  }
}
