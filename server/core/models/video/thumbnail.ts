import { ActivityIconObject } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MThumbnail } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { Op } from 'sequelize'
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
      fields: [ 'filename' ],
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
  static removeFiles (instance: ThumbnailModel) {
    // Don't block the transaction
    instance.removeFile()
      .catch(err => logger.error('Cannot remove thumbnail file %s.', instance.filename, { err }))
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

  toFormattedJSON () {
    return {
      height: this.height,
      width: this.width,
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
