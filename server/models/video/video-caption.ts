import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { isVideoCaptionLanguageValid } from '../../helpers/custom-validators/video-captions'
import { VideoCaption } from '../../../shared/models/videos/caption/video-caption.model'
import { CONFIG, STATIC_PATHS, VIDEO_LANGUAGES } from '../../initializers'
import { join } from 'path'
import { logger } from '../../helpers/logger'
import { unlinkPromise } from '../../helpers/core-utils'

export enum ScopeNames {
  WITH_VIDEO_UUID_AND_REMOTE = 'WITH_VIDEO_UUID_AND_REMOTE'
}

@Scopes({
  [ScopeNames.WITH_VIDEO_UUID_AND_REMOTE]: {
    include: [
      {
        attributes: [ 'uuid', 'remote' ],
        model: () => VideoModel.unscoped(),
        required: true
      }
    ]
  }
})

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
      instance.Video = await instance.$get('Video') as VideoModel
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

  static loadByVideoIdAndLanguage (videoId: string | number, language: string) {
    const videoInclude = {
      model: VideoModel.unscoped(),
      attributes: [ 'id', 'remote', 'uuid' ],
      where: { }
    }

    if (typeof videoId === 'string') videoInclude.where['uuid'] = videoId
    else videoInclude.where['id'] = videoId

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

  static insertOrReplaceLanguage (videoId: number, language: string, transaction: Sequelize.Transaction) {
    const values = {
      videoId,
      language
    }

    return VideoCaptionModel.upsert(values, { transaction })
  }

  static listVideoCaptions (videoId: number) {
    const query = {
      order: [ [ 'language', 'ASC' ] ],
      where: {
        videoId
      }
    }

    return VideoCaptionModel.scope(ScopeNames.WITH_VIDEO_UUID_AND_REMOTE).findAll(query)
  }

  static getLanguageLabel (language: string) {
    return VIDEO_LANGUAGES[language] || 'Unknown'
  }

  static deleteAllCaptionsOfRemoteVideo (videoId: number, transaction: Sequelize.Transaction) {
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

  toFormattedJSON (): VideoCaption {
    return {
      language: {
        id: this.language,
        label: VideoCaptionModel.getLanguageLabel(this.language)
      },
      captionPath: this.getCaptionStaticPath()
    }
  }

  getCaptionStaticPath () {
    return join(STATIC_PATHS.VIDEO_CAPTIONS, this.getCaptionName())
  }

  getCaptionName () {
    return `${this.Video.uuid}-${this.language}.vtt`
  }

  removeCaptionFile () {
    return unlinkPromise(CONFIG.STORAGE.CAPTIONS_DIR + this.getCaptionName())
  }
}
