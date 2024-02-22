import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Op, OrderItem, Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ActivityIdentifierObject, VideoCaption } from '@peertube/peertube-models'
import {
  MVideo,
  MVideoCaption,
  MVideoCaptionFormattable,
  MVideoCaptionLanguageUrl,
  MVideoCaptionVideo
} from '@server/types/models/index.js'
import { buildUUID } from '@peertube/peertube-node-utils'
import { isVideoCaptionLanguageValid } from '../../helpers/custom-validators/video-captions.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, VIDEO_LANGUAGES, WEBSERVER } from '../../initializers/constants.js'
import { SequelizeModel, buildWhereIdOrUUID, throwIfNotValid } from '../shared/index.js'
import { VideoModel } from './video.js'

export enum ScopeNames {
  WITH_VIDEO_UUID_AND_REMOTE = 'WITH_VIDEO_UUID_AND_REMOTE'
}

@Scopes(() => ({
  [ScopeNames.WITH_VIDEO_UUID_AND_REMOTE]: {
    include: [
      {
        attributes: [ 'id', 'uuid', 'remote' ],
        model: VideoModel.unscoped(),
        required: true
      }
    ]
  }
}))

@Table({
  tableName: 'videoCaption',
  indexes: [
    {
      fields: [ 'filename' ],
      unique: true
    },
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'language' ],
      unique: true
    }
  ]
})
export class VideoCaptionModel extends SequelizeModel<VideoCaptionModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoCaptionLanguage', value => throwIfNotValid(value, isVideoCaptionLanguageValid, 'language'))
  @Column
  language: string

  @AllowNull(false)
  @Column
  filename: string

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  fileUrl: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  @BeforeDestroy
  static async removeFiles (instance: VideoCaptionModel, options) {
    if (!instance.Video) {
      instance.Video = await instance.$get('Video', { transaction: options.transaction })
    }

    if (instance.isOwned()) {
      logger.info('Removing caption %s.', instance.filename)

      try {
        await instance.removeCaptionFile()
      } catch (err) {
        logger.error('Cannot remove caption file %s.', instance.filename)
      }
    }

    return undefined
  }

  static loadByVideoIdAndLanguage (videoId: string | number, language: string, transaction?: Transaction): Promise<MVideoCaptionVideo> {
    const videoInclude = {
      model: VideoModel.unscoped(),
      attributes: [ 'id', 'remote', 'uuid' ],
      where: buildWhereIdOrUUID(videoId)
    }

    const query = {
      where: {
        language
      },
      include: [
        videoInclude
      ],
      transaction
    }

    return VideoCaptionModel.findOne(query)
  }

  static loadWithVideoByFilename (filename: string): Promise<MVideoCaptionVideo> {
    const query = {
      where: {
        filename
      },
      include: [
        {
          model: VideoModel.unscoped(),
          attributes: [ 'id', 'remote', 'uuid' ]
        }
      ]
    }

    return VideoCaptionModel.findOne(query)
  }

  static async insertOrReplaceLanguage (caption: MVideoCaption, transaction: Transaction) {
    const existing = await VideoCaptionModel.loadByVideoIdAndLanguage(caption.videoId, caption.language, transaction)

    // Delete existing file
    if (existing) await existing.destroy({ transaction })

    return caption.save({ transaction })
  }

  static listVideoCaptions (videoId: number, transaction?: Transaction): Promise<MVideoCaptionVideo[]> {
    const query = {
      order: [ [ 'language', 'ASC' ] ] as OrderItem[],
      where: {
        videoId
      },
      transaction
    }

    return VideoCaptionModel.scope(ScopeNames.WITH_VIDEO_UUID_AND_REMOTE).findAll(query)
  }

  static async listCaptionsOfMultipleVideos (videoIds: number[], transaction?: Transaction) {
    const query = {
      order: [ [ 'language', 'ASC' ] ] as OrderItem[],
      where: {
        videoId: {
          [Op.in]: videoIds
        }
      },
      transaction
    }

    const captions = await VideoCaptionModel.scope(ScopeNames.WITH_VIDEO_UUID_AND_REMOTE).findAll<MVideoCaptionVideo>(query)
    const result: { [ id: number ]: MVideoCaptionVideo[] } = {}

    for (const id of videoIds) {
      result[id] = []
    }

    for (const caption of captions) {
      result[caption.videoId].push(caption)
    }

    return result
  }

  static getLanguageLabel (language: string) {
    return VIDEO_LANGUAGES[language] || 'Unknown'
  }

  static deleteAllCaptionsOfRemoteVideo (videoId: number, transaction: Transaction) {
    const query = {
      where: {
        videoId
      },
      transaction
    }

    return VideoCaptionModel.destroy(query)
  }

  static generateCaptionName (language: string) {
    return `${buildUUID()}-${language}.vtt`
  }

  isOwned () {
    return this.Video.remote === false
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MVideoCaptionFormattable): VideoCaption {
    return {
      language: {
        id: this.language,
        label: VideoCaptionModel.getLanguageLabel(this.language)
      },
      captionPath: this.getCaptionStaticPath(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  toActivityPubObject (this: MVideoCaptionLanguageUrl, video: MVideo): ActivityIdentifierObject {
    return {
      identifier: this.language,
      name: VideoCaptionModel.getLanguageLabel(this.language),
      url: this.getFileUrl(video)
    }
  }

  // ---------------------------------------------------------------------------

  getCaptionStaticPath (this: MVideoCaptionLanguageUrl) {
    return join(LAZY_STATIC_PATHS.VIDEO_CAPTIONS, this.filename)
  }

  getFSPath () {
    return join(CONFIG.STORAGE.CAPTIONS_DIR, this.filename)
  }

  removeCaptionFile (this: MVideoCaption) {
    return remove(this.getFSPath())
  }

  getFileUrl (this: MVideoCaptionLanguageUrl, video: MVideo) {
    if (video.isOwned()) return WEBSERVER.URL + this.getCaptionStaticPath()

    return this.fileUrl
  }

  isEqual (this: MVideoCaption, other: MVideoCaption) {
    if (this.fileUrl) return this.fileUrl === other.fileUrl

    return this.filename === other.filename
  }
}
