import { join } from 'path'
import { AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { LAZY_STATIC_PATHS, STATIC_PATHS, WEBSERVER } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { remove } from 'fs-extra'
import { CONFIG } from '../../initializers/config'
import { VideoModel } from './video'
import { VideoPlaylistModel } from './video-playlist'
import { ThumbnailType } from '../../../shared/models/videos/thumbnail.type'

@Table({
  tableName: 'thumbnail',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoPlaylistId' ],
      unique: true
    }
  ]
})
export class ThumbnailModel extends Model<ThumbnailModel> {

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

  @AllowNull(false)
  @Column
  type: ThumbnailType

  @AllowNull(true)
  @Column
  fileUrl: string

  @AllowNull(true)
  @Column
  automaticallyGenerated: boolean

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

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoPlaylist: VideoPlaylistModel

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  private static types: { [ id in ThumbnailType ]: { label: string, directory: string, staticPath: string } } = {
    [ThumbnailType.MINIATURE]: {
      label: 'miniature',
      directory: CONFIG.STORAGE.THUMBNAILS_DIR,
      staticPath: STATIC_PATHS.THUMBNAILS
    },
    [ThumbnailType.PREVIEW]: {
      label: 'preview',
      directory: CONFIG.STORAGE.PREVIEWS_DIR,
      staticPath: LAZY_STATIC_PATHS.PREVIEWS
    }
  }

  @AfterDestroy
  static removeFiles (instance: ThumbnailModel) {
    logger.info('Removing %s file %s.', ThumbnailModel.types[instance.type].label, instance.filename)

    // Don't block the transaction
    instance.removeThumbnail()
            .catch(err => logger.error('Cannot remove thumbnail file %s.', instance.filename, err))
  }

  static loadByName (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return ThumbnailModel.findOne(query)
  }

  static generateDefaultPreviewName (videoUUID: string) {
    return videoUUID + '.jpg'
  }

  getFileUrl () {
    if (this.fileUrl) return this.fileUrl

    const staticPath = ThumbnailModel.types[this.type].staticPath
    return WEBSERVER.URL + staticPath + this.filename
  }

  getPath () {
    const directory = ThumbnailModel.types[this.type].directory
    return join(directory, this.filename)
  }

  removeThumbnail () {
    return remove(this.getPath())
  }
}
