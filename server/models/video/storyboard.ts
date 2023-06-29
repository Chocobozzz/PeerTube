import { remove } from 'fs-extra'
import { join } from 'path'
import { AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { CONFIG } from '@server/initializers/config'
import { MStoryboard, MStoryboardVideo, MVideo } from '@server/types/models'
import { Storyboard } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { logger } from '../../helpers/logger'
import { CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, WEBSERVER } from '../../initializers/constants'
import { VideoModel } from './video'
import { Transaction } from 'sequelize'

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
export class StoryboardModel extends Model<Partial<AttributesOnly<StoryboardModel>>> {

  @AllowNull(false)
  @Column
  filename: string

  @AllowNull(false)
  @Column
  totalHeight: number

  @AllowNull(false)
  @Column
  totalWidth: number

  @AllowNull(false)
  @Column
  spriteHeight: number

  @AllowNull(false)
  @Column
  spriteWidth: number

  @AllowNull(false)
  @Column
  spriteDuration: number

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
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
  static removeInstanceFile (instance: StoryboardModel) {
    logger.info('Removing storyboard file %s.', instance.filename)

    // Don't block the transaction
    instance.removeFile()
            .catch(err => logger.error('Cannot remove storyboard file %s.', instance.filename, { err }))
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

  static loadWithVideoByFilename (filename: string): Promise<MStoryboardVideo> {
    const query = {
      where: {
        filename
      },
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
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

  // ---------------------------------------------------------------------------

  getOriginFileUrl (video: MVideo) {
    if (video.isOwned()) {
      return WEBSERVER.URL + this.getLocalStaticPath()
    }

    return this.fileUrl
  }

  getLocalStaticPath () {
    return LAZY_STATIC_PATHS.STORYBOARDS + this.filename
  }

  getPath () {
    return join(CONFIG.STORAGE.STORYBOARDS_DIR, this.filename)
  }

  removeFile () {
    return remove(this.getPath())
  }

  toFormattedJSON (this: MStoryboardVideo): Storyboard {
    return {
      storyboardPath: this.getLocalStaticPath(),

      totalHeight: this.totalHeight,
      totalWidth: this.totalWidth,

      spriteWidth: this.spriteWidth,
      spriteHeight: this.spriteHeight,

      spriteDuration: this.spriteDuration
    }
  }
}
