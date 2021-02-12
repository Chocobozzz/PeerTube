import { remove } from 'fs-extra'
import { join } from 'path'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { buildRemoteVideoBaseUrl } from '@server/helpers/activitypub'
import { MThumbnailVideo, MVideoAccountLight } from '@server/types/models'
import { ThumbnailType } from '../../../shared/models/videos/thumbnail.type'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, STATIC_PATHS, WEBSERVER } from '../../initializers/constants'
import { VideoModel } from './video'
import { VideoPlaylistModel } from './video-playlist'

@Table({
  tableName: 'thumbnail',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoPlaylistId' ],
      unique: true
    },
    {
      fields: [ 'filename', 'type' ],
      unique: true
    }
  ]
})
export class ThumbnailModel extends Model {

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
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
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

  private static readonly types: { [ id in ThumbnailType ]: { label: string, directory: string, staticPath: string } } = {
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

  static loadWithVideoByName (filename: string, thumbnailType: ThumbnailType): Promise<MThumbnailVideo> {
    const query = {
      where: {
        filename,
        type: thumbnailType
      },
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }

    return ThumbnailModel.findOne(query)
  }

  getFileUrl (video: MVideoAccountLight) {
    const staticPath = ThumbnailModel.types[this.type].staticPath + this.filename

    if (video.isOwned()) return WEBSERVER.URL + staticPath
    if (this.fileUrl) return this.fileUrl

    // Fallback if we don't have a file URL
    return buildRemoteVideoBaseUrl(video, staticPath)
  }

  getPath () {
    const directory = ThumbnailModel.types[this.type].directory
    return join(directory, this.filename)
  }

  removeThumbnail () {
    return remove(this.getPath())
  }
}
