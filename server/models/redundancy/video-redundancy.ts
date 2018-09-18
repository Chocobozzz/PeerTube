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
import { getVideoSort, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid, isUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONFIG, CONSTRAINTS_FIELDS, VIDEO_EXT_MIMETYPE } from '../../initializers'
import { VideoFileModel } from '../video/video-file'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../video/video'
import { VideoRedundancyStrategy } from '../../../shared/models/redundancy'
import { logger } from '../../helpers/logger'
import { CacheFileObject } from '../../../shared'
import { VideoChannelModel } from '../video/video-channel'
import { ServerModel } from '../server/server'
import { sample } from 'lodash'
import { isTestInstance } from '../../helpers/core-utils'
import * as Bluebird from 'bluebird'

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

  static async getVideoSample (p: Bluebird<VideoModel[]>) {
    const rows = await p
    const ids = rows.map(r => r.id)
    const id = sample(ids)

    return VideoModel.loadWithFile(id, undefined, !isTestInstance())
  }

  static async findMostViewToDuplicate (randomizedFactor: number) {
    // On VideoModel!
    const query = {
      attributes: [ 'id', 'views' ],
      logging: !isTestInstance(),
      limit: randomizedFactor,
      order: getVideoSort('-views'),
      include: [
        await VideoRedundancyModel.buildVideoFileForDuplication(),
        VideoRedundancyModel.buildServerRedundancyInclude()
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async findTrendingToDuplicate (randomizedFactor: number) {
    // On VideoModel!
    const query = {
      attributes: [ 'id', 'views' ],
      subQuery: false,
      logging: !isTestInstance(),
      group: 'VideoModel.id',
      limit: randomizedFactor,
      order: getVideoSort('-trending'),
      include: [
        await VideoRedundancyModel.buildVideoFileForDuplication(),
        VideoRedundancyModel.buildServerRedundancyInclude(),

        VideoModel.buildTrendingQuery(CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS)
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async findRecentlyAddedToDuplicate (randomizedFactor: number, minViews: number) {
    // On VideoModel!
    const query = {
      attributes: [ 'id', 'publishedAt' ],
      // logging: !isTestInstance(),
      limit: randomizedFactor,
      order: getVideoSort('-publishedAt'),
      where: {
        views: {
          [ Sequelize.Op.gte ]: minViews
        }
      },
      include: [
        await VideoRedundancyModel.buildVideoFileForDuplication(),
        VideoRedundancyModel.buildServerRedundancyInclude()
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async getTotalDuplicated (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()

    const options = {
      logging: !isTestInstance(),
      include: [
        {
          attributes: [],
          model: VideoRedundancyModel,
          required: true,
          where: {
            actorId: actor.id,
            strategy
          }
        }
      ]
    }

    return VideoFileModel.sum('size', options)
  }

  static listAllExpired () {
    const query = {
      logging: !isTestInstance(),
      where: {
        expiresOn: {
          [ Sequelize.Op.lt ]: new Date()
        }
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO)
                               .findAll(query)
  }

  static async getStats (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()

    const query = {
      raw: true,
      attributes: [
        [ Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoFile.size')), '0'), 'totalUsed' ],
        [ Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', 'videoId')), 'totalVideos' ],
        [ Sequelize.fn('COUNT', 'videoFileId'), 'totalVideoFiles' ]
      ],
      where: {
        strategy,
        actorId: actor.id
      },
      include: [
        {
          attributes: [],
          model: VideoFileModel,
          required: true
        }
      ]
    }

    return VideoRedundancyModel.find(query as any) // FIXME: typings
      .then((r: any) => ({
        totalUsed: parseInt(r.totalUsed.toString(), 10),
        totalVideos: r.totalVideos,
        totalVideoFiles: r.totalVideoFiles
      }))
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

  // Don't include video files we already duplicated
  private static async buildVideoFileForDuplication () {
    const actor = await getServerActor()

    const notIn = Sequelize.literal(
      '(' +
        `SELECT "videoFileId" FROM "videoRedundancy" WHERE "actorId" = ${actor.id} AND "expiresOn" >= NOW()` +
      ')'
    )

    return {
      attributes: [],
      model: VideoFileModel.unscoped(),
      required: true,
      where: {
        id: {
          [ Sequelize.Op.notIn ]: notIn
        }
      }
    }
  }

  private static buildServerRedundancyInclude () {
    return {
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
  }
}
