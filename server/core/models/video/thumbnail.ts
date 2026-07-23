import { ActivityIconObject, Thumbnail, type ThumbnailAspectRatio } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { MThumbnail } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { Op, Transaction } from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { logger } from '../../helpers/logger.js'
import { CONSTRAINTS_FIELDS, FILES_CACHE, LAZY_STATIC_PATHS, MIMETYPES, WEBSERVER } from '../../initializers/constants.js'
import { SequelizeModel } from '../shared/sequelize-type.js'
import { buildSQLAttributes } from '../shared/table.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { VideoModel } from './video.js'

// A thumbnail always belongs to a video or to a playlist, never to both
type ThumbnailOwner =
  | { videoId: number, videoPlaylistId?: never }
  | { videoPlaylistId: number, videoId?: never }

function pickOwner (owner: ThumbnailOwner): ThumbnailOwner {
  if (owner.videoId !== undefined) return { videoId: owner.videoId }
  if (owner.videoPlaylistId !== undefined) return { videoPlaylistId: owner.videoPlaylistId }

  throw new Error('Cannot build thumbnail query without a video id or a video playlist id')
}

export const thumbnailAPIAttributes = [
  'filename',
  'fileUrl',
  'width',
  'height',
  'aspectRatio'
] as const satisfies (keyof AttributesOnly<ThumbnailModel>)[]

@Table({
  tableName: 'thumbnail',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoPlaylistId' ]
    },
    {
      fields: [ 'filename' ],
      unique: true
    },
    // A video/playlist can only have one thumbnail of a given size
    {
      fields: [ 'videoId', 'width', 'height' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      },
      unique: true
    },
    {
      fields: [ 'videoPlaylistId', 'width', 'height' ],
      where: {
        videoPlaylistId: {
          [Op.ne]: null
        }
      },
      unique: true
    }
  ]
})
export class ThumbnailModel extends SequelizeModel<ThumbnailModel> {
  @AllowNull(false)
  @Column
  declare filename: string

  @AllowNull(true)
  @Default(null)
  @Column
  declare height: number

  @AllowNull(true)
  @Default(null)
  @Column
  declare width: number

  @AllowNull(false)
  @Default(null)
  @Column
  declare aspectRatio: ThumbnailAspectRatio

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  declare fileUrl: string

  @AllowNull(true)
  @Column
  declare automaticallyGenerated: boolean

  @AllowNull(false)
  @Column
  declare cached: boolean

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  declare videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare VideoPlaylist: Awaited<VideoPlaylistModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AfterDestroy
  static removeFiles (instance: ThumbnailModel, options: { transaction?: Transaction }) {
    afterCommitIfTransaction(options.transaction, () => {
      instance.removeFile()
        .catch(err => logger.error('Cannot remove thumbnail file %s.', instance.filename, { err }))
    })
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

  static loadByFilename (filename: string): Promise<MThumbnail> {
    const query = {
      where: { filename }
    }

    return ThumbnailModel.findOne(query)
  }

  static listRemoteCached () {
    return this.findAll<MThumbnail>({
      where: {
        cached: true,
        fileUrl: {
          [Op.ne]: null
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  static listOf (options: ThumbnailOwner & { transaction?: Transaction }) {
    return ThumbnailModel.findAll({
      where: pickOwner(options),
      transaction: options.transaction
    })
  }

  // Always fetch the thumbnails from the database to prevent concurrency issues
  static async removeAllOf (options: ThumbnailOwner & { transaction?: Transaction }) {
    for (const thumbnail of await ThumbnailModel.listOf(options)) {
      await thumbnail.destroy({ transaction: options.transaction })
    }
  }

  static async replaceAllOf (options: ThumbnailOwner & {
    thumbnails: MThumbnail[]
    transaction?: Transaction
  }) {
    const { thumbnails, transaction } = options
    const owner = pickOwner(options)

    if (thumbnails.length === 0) {
      throw new Error('Cannot replace thumbnails with an empty array, at least one thumbnail is required')
    }

    // Thumbnails that are updated in place instead of being re-created
    const keptIds = new Set(thumbnails.map(t => t.id).filter(id => !!id))

    // Remove the old thumbnails first, otherwise the new ones would conflict with the unique constraint on their size
    for (const thumbnail of await ThumbnailModel.listOf({ ...owner, transaction })) {
      if (keptIds.has(thumbnail.id)) continue

      await thumbnail.destroy({ transaction })
    }

    const savedThumbnails: ThumbnailModel[] = []

    for (const thumbnail of thumbnails) {
      if (owner.videoId !== undefined) thumbnail.videoId = owner.videoId
      else thumbnail.videoPlaylistId = owner.videoPlaylistId

      savedThumbnails.push(await thumbnail.save({ transaction }))
    }

    return savedThumbnails
  }

  // ---------------------------------------------------------------------------

  getFSPath () {
    return join(CONFIG.STORAGE.THUMBNAILS_DIR, this.filename)
  }

  getFSCachedPath () {
    return join(FILES_CACHE.THUMBNAILS.DIRECTORY, this.filename)
  }

  removeFile () {
    const path = this.cached
      ? this.getFSCachedPath()
      : this.getFSPath()

    logger.info('Removing thumbnail file ' + path)

    return remove(path)
  }

  getLocalFileUrl () {
    // Remote files are cached by our instance
    return WEBSERVER.URL + this.getFileStaticPath()
  }

  getFileStaticPath () {
    return LAZY_STATIC_PATHS.THUMBNAILS + this.filename
  }

  isLocal () {
    return !this.fileUrl
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (): Thumbnail {
    return {
      height: this.height,
      width: this.width,
      aspectRatio: this.aspectRatio,
      fileUrl: this.getLocalFileUrl()
    }
  }

  toActivityPubObject (this: MThumbnail): ActivityIconObject {
    return {
      type: 'Image',
      url: this.getLocalFileUrl(),
      mediaType: MIMETYPES.IMAGE.EXT_MIMETYPE[extname(this.filename)],
      width: this.width,
      height: this.height
    }
  }
}
