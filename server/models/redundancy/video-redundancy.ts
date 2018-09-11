import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is,
  Model,
  Scopes,
  Sequelize,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ActorModel } from '../activitypub/actor'
import { throwIfNotValid } from '../utils'
import { isActivityPubUrlValid, isUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS, VIDEO_EXT_MIMETYPE } from '../../initializers'
import { VideoFileModel } from '../video/video-file'
import { isDateValid } from '../../helpers/custom-validators/misc'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../video/video'
import { VideoRedundancyStrategy } from '../../../shared/models/redundancy'
import { logger } from '../../helpers/logger'
import { CacheFileObject } from '../../../shared'
import { VideoChannelModel } from '../video/video-channel'
import { ServerModel } from '../server/server'
import { sample } from 'lodash'
import { isTestInstance } from '../../helpers/core-utils'

export enum ScopeNames {
  WITH_VIDEO = 'WITH_VIDEO'
}

@Scopes({
  [ ScopeNames.WITH_VIDEO ]: {
    include: [
      {
        model: () => VideoFileModel,
        required: true,
        include: [
          {
            model: () => VideoModel,
            required: true
          }
        ]
      }
    ]
  }
})

@Table({
  tableName: 'videoRedundancy',
  indexes: [
    {
      fields: [ 'videoFileId' ]
    },
    {
      fields: [ 'actorId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoRedundancyModel extends Model<VideoRedundancyModel> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  expiresOn: Date

  @AllowNull(false)
  @Is('VideoRedundancyFileUrl', value => throwIfNotValid(value, isUrlValid, 'fileUrl'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max))
  fileUrl: string

  @AllowNull(false)
  @Is('VideoRedundancyUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max))
  url: string

  @AllowNull(true)
  @Column
  strategy: string // Only used by us

  @ForeignKey(() => VideoFileModel)
  @Column
  videoFileId: number

  @BelongsTo(() => VideoFileModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoFile: VideoFileModel

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Actor: ActorModel

  @AfterDestroy
  static removeFilesAndSendDelete (instance: VideoRedundancyModel) {
    // Not us
    if (!instance.strategy) return

    logger.info('Removing video file %s-.', instance.VideoFile.Video.uuid, instance.VideoFile.resolution)

    return instance.VideoFile.Video.removeFile(instance.VideoFile)
  }

  static loadByFileId (videoFileId: number) {
    const query = {
      where: {
        videoFileId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static loadByUrl (url: string) {
    const query = {
      where: {
        url
      }
    }

    return VideoRedundancyModel.findOne(query)
  }

  static async findMostViewToDuplicate (randomizedFactor: number) {
    // On VideoModel!
    const query = {
      logging: !isTestInstance(),
      limit: randomizedFactor,
      order: [ [ 'views', 'DESC' ] ],
      include: [
        {
          model: VideoFileModel.unscoped(),
          required: true,
          where: {
            id: {
              [ Sequelize.Op.notIn ]: await VideoRedundancyModel.buildExcludeIn()
            }
          }
        },
        {
          attributes: [],
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [],
              model: ActorModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [],
                  model: ServerModel.unscoped(),
                  required: true,
                  where: {
                    redundancyAllowed: true
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    const rows = await VideoModel.unscoped().findAll(query)

    return sample(rows)
  }

  static async getVideoFiles (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()

    const queryVideoFiles = {
      logging: !isTestInstance(),
      where: {
        actorId: actor.id,
        strategy
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO)
                               .findAll(queryVideoFiles)
  }

  static listAllExpired () {
    const query = {
      logging: !isTestInstance(),
      where: {
        expiresOn: {
          [Sequelize.Op.lt]: new Date()
        }
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO)
                               .findAll(query)
  }

  toActivityPubObject (): CacheFileObject {
    return {
      id: this.url,
      type: 'CacheFile' as 'CacheFile',
      object: this.VideoFile.Video.url,
      expires: this.expiresOn.toISOString(),
      url: {
        type: 'Link',
        mimeType: VIDEO_EXT_MIMETYPE[ this.VideoFile.extname ] as any,
        href: this.fileUrl,
        height: this.VideoFile.resolution,
        size: this.VideoFile.size,
        fps: this.VideoFile.fps
      }
    }
  }

  private static async buildExcludeIn () {
    const actor = await getServerActor()

    return Sequelize.literal(
      '(' +
        `SELECT "videoFileId" FROM "videoRedundancy" WHERE "actorId" = ${actor.id} AND "expiresOn" >= NOW()` +
      ')'
    )
  }
}
