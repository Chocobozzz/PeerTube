import { ActivityIconObject, ThumbnailType, type ThumbnailType_Type } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { MThumbnail, MThumbnailVideo, MVideo, MVideoPlaylist } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import {
  AfterDestroy,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, WEBSERVER } from '../../initializers/constants.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { VideoModel } from './video.js'
import { SequelizeModel } from '../shared/sequelize-type.js'

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
export class ThumbnailModel extends SequelizeModel<ThumbnailModel> {

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
  type: ThumbnailType_Type

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  fileUrl: string

  @AllowNull(true)
  @Column
  automaticallyGenerated: boolean

  @AllowNull(false)
  @Column
  onDisk: boolean

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoPlaylist: Awaited<VideoPlaylistModel>

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  // If this thumbnail replaced existing one, track the old name
  previousThumbnailFilename: string

  private static readonly types: { [ id in ThumbnailType_Type ]: { label: string, directory: string, staticPath: string } } = {
    [ThumbnailType.MINIATURE]: {
      label: 'miniature',
      directory: CONFIG.STORAGE.THUMBNAILS_DIR,
      staticPath: LAZY_STATIC_PATHS.THUMBNAILS
    },
    [ThumbnailType.PREVIEW]: {
      label: 'preview',
      directory: CONFIG.STORAGE.PREVIEWS_DIR,
      staticPath: LAZY_STATIC_PATHS.PREVIEWS
    }
  }

  @BeforeCreate
  @BeforeUpdate
  static removeOldFile (instance: ThumbnailModel, options) {
    return afterCommitIfTransaction(options.transaction, () => instance.removePreviousFilenameIfNeeded())
  }

  @AfterDestroy
  static removeFiles (instance: ThumbnailModel) {
    logger.info('Removing %s file %s.', ThumbnailModel.types[instance.type].label, instance.filename)

    // Don't block the transaction
    instance.removeThumbnail()
            .catch(err => logger.error('Cannot remove thumbnail file %s.', instance.filename, { err }))
  }

  static loadByFilename (filename: string, thumbnailType: ThumbnailType_Type): Promise<MThumbnail> {
    const query = {
      where: {
        filename,
        type: thumbnailType
      }
    }

    return ThumbnailModel.findOne(query)
  }

  static loadWithVideoByFilename (filename: string, thumbnailType: ThumbnailType_Type): Promise<MThumbnailVideo> {
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

  static listRemoteOnDisk () {
    return this.findAll<MThumbnail>({
      where: {
        onDisk: true
      },
      include: [
        {
          attributes: [ 'id' ],
          model: VideoModel.unscoped(),
          required: true,
          where: {
            remote: true
          }
        }
      ]
    })
  }

  // ---------------------------------------------------------------------------

  static buildPath (type: ThumbnailType_Type, filename: string) {
    const directory = ThumbnailModel.types[type].directory

    return join(directory, filename)
  }

  // ---------------------------------------------------------------------------

  getOriginFileUrl (videoOrPlaylist: MVideo | MVideoPlaylist) {
    const staticPath = ThumbnailModel.types[this.type].staticPath + this.filename

    // FIXME: typings
    if ((videoOrPlaylist as MVideo).isOwned()) return WEBSERVER.URL + staticPath

    return this.fileUrl
  }

  getLocalStaticPath () {
    return ThumbnailModel.types[this.type].staticPath + this.filename
  }

  getPath () {
    return ThumbnailModel.buildPath(this.type, this.filename)
  }

  getPreviousPath () {
    return ThumbnailModel.buildPath(this.type, this.previousThumbnailFilename)
  }

  removeThumbnail () {
    return remove(this.getPath())
  }

  removePreviousFilenameIfNeeded () {
    if (!this.previousThumbnailFilename) return

    const previousPath = this.getPreviousPath()
    remove(previousPath)
      .catch(err => logger.error('Cannot remove previous thumbnail file %s.', previousPath, { err }))

    this.previousThumbnailFilename = undefined
  }

  isOwned () {
    return !this.fileUrl
  }

  // ---------------------------------------------------------------------------

  toActivityPubObject (this: MThumbnail, video: MVideo): ActivityIconObject {
    return {
      type: 'Image',
      url: this.getOriginFileUrl(video),
      mediaType: 'image/jpeg',
      width: this.width,
      height: this.height
    }
  }
}
