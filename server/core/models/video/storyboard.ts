import { FileStorage, type FileStorageType, Storyboard } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildCommonFileObjectStorageUrl, removeCommonFileObjectStorage } from '@server/lib/object-storage/common-files.js'
import { MStoryboard, MStoryboardVideo, MVideo } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
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
import { createLogger } from '../../helpers/logger.js'
import { CONSTRAINTS_FIELDS, FILES_CACHE, LAZY_STATIC_PATHS, WEBSERVER } from '../../initializers/constants.js'
import { SequelizeModel, doesExist } from '../shared/index.js'
import { VideoModel } from './video.js'

const logger = createLogger()

@Table({
  tableName: 'storyboard',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    },
    {
      fields: [ 'filename' ],
      unique: true
    }
  ]
})
export class StoryboardModel extends SequelizeModel<StoryboardModel> {
  @AllowNull(false)
  @Column
  declare filename: string

  @AllowNull(false)
  @Column
  declare totalHeight: number

  @AllowNull(false)
  @Column
  declare totalWidth: number

  @AllowNull(false)
  @Column
  declare spriteHeight: number

  @AllowNull(false)
  @Column
  declare spriteWidth: number

  @AllowNull(false)
  @Column
  declare spriteDuration: number

  @AllowNull(false)
  @Default(FileStorage.FILE_SYSTEM)
  @Column
  declare storage: FileStorageType

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  declare fileUrl: string

  @AllowNull(false)
  @Column
  declare cached: boolean

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AfterDestroy
  static removeInstanceFile (instance: StoryboardModel, options: { transaction?: Transaction }) {
    // Keep the file if the transaction is rolled back
    afterCommitIfTransaction(options.transaction, () => {
      // Don't block the caller
      instance.removeFile()
        .catch(err => logger.error('Cannot remove storyboard file %s.', instance.filename, { err }))
    })
  }

  static loadByVideo (videoId: number, transaction?: Transaction): Promise<MStoryboard> {
    const query = {
      where: {
        videoId
      },
      transaction
    }

    return StoryboardModel.findOne(query)
  }

  static loadByFilename (filename: string): Promise<MStoryboard> {
    const query = {
      where: {
        filename
      }
    }

    return StoryboardModel.findOne(query)
  }

  // ---------------------------------------------------------------------------

  static async listStoryboardsOf (video: MVideo): Promise<MStoryboardVideo[]> {
    const query = {
      where: {
        videoId: video.id
      }
    }

    const storyboards = await StoryboardModel.findAll<MStoryboard>(query)

    return storyboards.map(s => Object.assign(s, { Video: video }))
  }

  static listRemoteCached () {
    return this.findAll<MStoryboard>({
      where: {
        cached: true,
        fileUrl: {
          [Op.ne]: null
        }
      }
    })
  }

  static doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "storyboard" ' +
      `WHERE "filename" = $filename AND "storage" = $storage AND "fileUrl" IS NULL LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // Don't update a storyboard that has been replaced or moved in the meantime
  static async updateStorageIfUnchanged (filename: string, from: FileStorageType, to: FileStorageType) {
    const [ affectedCount ] = await StoryboardModel.update(
      { storage: to },
      { where: { filename, storage: from, fileUrl: null } }
    )

    return affectedCount !== 0
  }

  // ---------------------------------------------------------------------------

  getLocalFileUrl () {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) {
      return buildCommonFileObjectStorageUrl('storyboards', this.filename)
    }

    // Remote files are cached by our instance
    return WEBSERVER.URL + this.getFileStaticPath()
  }

  // Returns null if the file is in object storage: it is not served by our instance
  getFileStaticPath () {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) return null

    return LAZY_STATIC_PATHS.STORYBOARDS + this.filename
  }

  getFSPath () {
    return join(CONFIG.STORAGE.STORYBOARDS_DIR, this.filename)
  }

  getFSCachedPath () {
    return join(FILES_CACHE.STORYBOARDS.DIRECTORY, this.filename)
  }

  isLocal () {
    return !this.fileUrl
  }

  removeFile () {
    if (!this.cached && this.storage === FileStorage.OBJECT_STORAGE) {
      logger.info('Removing storyboard file %s from object storage', this.filename)

      return removeCommonFileObjectStorage('storyboards', this.filename)
    }

    const path = this.cached
      ? this.getFSCachedPath()
      : this.getFSPath()

    logger.info('Removing storyboard file ' + path)

    return remove(path)
  }

  toFormattedJSON (this: MStoryboardVideo): Storyboard {
    return {
      fileUrl: this.getLocalFileUrl(),
      storyboardPath: this.getFileStaticPath(),

      totalHeight: this.totalHeight,
      totalWidth: this.totalWidth,

      spriteWidth: this.spriteWidth,
      spriteHeight: this.spriteHeight,

      spriteDuration: this.spriteDuration
    }
  }
}
