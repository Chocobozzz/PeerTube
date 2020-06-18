import { OrderItem, Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { buildWhereIdOrUUID, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { isVideoCaptionLanguageValid } from '../../helpers/custom-validators/video-captions'
import { VideoCaption } from '../../../shared/models/videos/caption/video-caption.model'
import { CONSTRAINTS_FIELDS, LAZY_STATIC_PATHS, VIDEO_LANGUAGES, WEBSERVER } from '../../initializers/constants'
import { join } from 'path'
import { logger } from '../../helpers/logger'
import { remove } from 'fs-extra'
import { CONFIG } from '../../initializers/config'
import * as Bluebird from 'bluebird'
import { MVideoAccountLight, MVideoCaptionFormattable, MVideoCaptionVideo } from '@server/types/models'
import { buildRemoteVideoBaseUrl } from '@server/helpers/activitypub'

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
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'language' ],
      unique: true
    }
  ]
})
export class VideoCaptionModel extends Model<VideoCaptionModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoCaptionLanguage', value => throwIfNotValid(value, isVideoCaptionLanguageValid, 'language'))
  @Column
  language: string

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
  Video: VideoModel

  @BeforeDestroy
  static async removeFiles (instance: VideoCaptionModel) {
    if (!instance.Video) {
      instance.Video = await instance.$get('Video')
    }

    if (instance.isOwned()) {
      logger.info('Removing captions %s of video %s.', instance.Video.uuid, instance.language)

      try {
        await instance.removeCaptionFile()
      } catch (err) {
        logger.error('Cannot remove caption file of video %s.', instance.Video.uuid)
      }
    }

    return undefined
  }

  static loadByVideoIdAndLanguage (videoId: string | number, language: string): Bluebird<MVideoCaptionVideo> {
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
      ]
    }

    return VideoCaptionModel.findOne(query)
  }

  static insertOrReplaceLanguage (videoId: number, language: string, fileUrl: string, transaction: Transaction) {
    const values = {
      videoId,
      language,
      fileUrl
    }

    return VideoCaptionModel.upsert(values, { transaction, returning: true })
      .then(([ caption ]) => caption)
  }

  static listVideoCaptions (videoId: number): Bluebird<MVideoCaptionVideo[]> {
    const query = {
      order: [ [ 'language', 'ASC' ] ] as OrderItem[],
      where: {
        videoId
      }
    }

    return VideoCaptionModel.scope(ScopeNames.WITH_VIDEO_UUID_AND_REMOTE).findAll(query)
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

  isOwned () {
    return this.Video.remote === false
  }

  toFormattedJSON (this: MVideoCaptionFormattable): VideoCaption {
    return {
      language: {
        id: this.language,
        label: VideoCaptionModel.getLanguageLabel(this.language)
      },
      captionPath: this.getCaptionStaticPath()
    }
  }

  getCaptionStaticPath (this: MVideoCaptionFormattable) {
    return join(LAZY_STATIC_PATHS.VIDEO_CAPTIONS, this.getCaptionName())
  }

  getCaptionName (this: MVideoCaptionFormattable) {
    return `${this.Video.uuid}-${this.language}.vtt`
  }

  removeCaptionFile (this: MVideoCaptionFormattable) {
    return remove(CONFIG.STORAGE.CAPTIONS_DIR + this.getCaptionName())
  }

  getFileUrl (video: MVideoAccountLight) {
    if (!this.Video) this.Video = video as VideoModel

    if (video.isOwned()) return WEBSERVER.URL + this.getCaptionStaticPath()
    if (this.fileUrl) return this.fileUrl

    // Fallback if we don't have a file URL
    return buildRemoteVideoBaseUrl(video, this.getCaptionStaticPath())
  }
}
