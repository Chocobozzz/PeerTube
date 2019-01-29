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
import { ActorModel } from '../activitypub/actor'
import { getVideoSort, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid, isUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONFIG, CONSTRAINTS_FIELDS, MIMETYPES } from '../../initializers'
import { VideoFileModel } from '../video/video-file'
import { getServerActor } from '../../helpers/utils'
import { VideoModel } from '../video/video'
import { VideoRedundancyStrategy } from '../../../shared/models/redundancy'
import { logger } from '../../helpers/logger'
import { CacheFileObject, VideoPrivacy } from '../../../shared'
import { VideoChannelModel } from '../video/video-channel'
import { ServerModel } from '../server/server'
import { sample } from 'lodash'
import { isTestInstance } from '../../helpers/core-utils'
import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { VideoStreamingPlaylistModel } from '../video/video-streaming-playlist'

export enum ScopeNames {
  WITH_VIDEO = 'WITH_VIDEO'
}

@Scopes({
  [ ScopeNames.WITH_VIDEO ]: {
    include: [
      {
        model: () => VideoFileModel,
        required: false,
        include: [
          {
            model: () => VideoModel,
            required: true
          }
        ]
      },
      {
        model: () => VideoStreamingPlaylistModel,
        required: false,
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
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoFile: VideoFileModel

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @Column
  videoStreamingPlaylistId: number

  @BelongsTo(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoStreamingPlaylist: VideoStreamingPlaylistModel

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

  @BeforeDestroy
  static async removeFile (instance: VideoRedundancyModel) {
    if (!instance.isOwned()) return

    if (instance.videoFileId) {
      const videoFile = await VideoFileModel.loadWithVideo(instance.videoFileId)

      const logIdentifier = `${videoFile.Video.uuid}-${videoFile.resolution}`
      logger.info('Removing duplicated video file %s.', logIdentifier)

      videoFile.Video.removeFile(videoFile, true)
               .catch(err => logger.error('Cannot delete %s files.', logIdentifier, { err }))
    }

    if (instance.videoStreamingPlaylistId) {
      const videoStreamingPlaylist = await VideoStreamingPlaylistModel.loadWithVideo(instance.videoStreamingPlaylistId)

      const videoUUID = videoStreamingPlaylist.Video.uuid
      logger.info('Removing duplicated video streaming playlist %s.', videoUUID)

      videoStreamingPlaylist.Video.removeStreamingPlaylist(true)
               .catch(err => logger.error('Cannot delete video streaming playlist files of %s.', videoUUID, { err }))
    }

    return undefined
  }

  static async loadLocalByFileId (videoFileId: number) {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        videoFileId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static async loadLocalByStreamingPlaylistId (videoStreamingPlaylistId: number) {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        videoStreamingPlaylistId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static loadByUrl (url: string, transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        url
      },
      transaction
    }

    return VideoRedundancyModel.findOne(query)
  }

  static async isLocalByVideoUUIDExists (uuid: string) {
    const actor = await getServerActor()

    const query = {
      raw: true,
      attributes: [ 'id' ],
      where: {
        actorId: actor.id
      },
      include: [
        {
          attributes: [ ],
          model: VideoFileModel,
          required: true,
          include: [
            {
              attributes: [ ],
              model: VideoModel,
              required: true,
              where: {
                uuid
              }
            }
          ]
        }
      ]
    }

    return VideoRedundancyModel.findOne(query)
      .then(r => !!r)
  }

  static async getVideoSample (p: Bluebird<VideoModel[]>) {
    const rows = await p
    const ids = rows.map(r => r.id)
    const id = sample(ids)

    return VideoModel.loadWithFiles(id, undefined, !isTestInstance())
  }

  static async findMostViewToDuplicate (randomizedFactor: number) {
    // On VideoModel!
    const query = {
      attributes: [ 'id', 'views' ],
      limit: randomizedFactor,
      order: getVideoSort('-views'),
      where: {
        privacy: VideoPrivacy.PUBLIC
      },
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
      group: 'VideoModel.id',
      limit: randomizedFactor,
      order: getVideoSort('-trending'),
      where: {
        privacy: VideoPrivacy.PUBLIC
      },
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
      limit: randomizedFactor,
      order: getVideoSort('-publishedAt'),
      where: {
        privacy: VideoPrivacy.PUBLIC,
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

  static async loadOldestLocalThatAlreadyExpired (strategy: VideoRedundancyStrategy, expiresAfterMs: number) {
    const expiredDate = new Date()
    expiredDate.setMilliseconds(expiredDate.getMilliseconds() - expiresAfterMs)

    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        strategy,
        createdAt: {
          [ Sequelize.Op.lt ]: expiredDate
        }
      }
    }

    return VideoRedundancyModel.scope([ ScopeNames.WITH_VIDEO ]).findOne(query)
  }

  static async getTotalDuplicated (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()

    const options = {
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

    return VideoFileModel.sum('size', options as any) // FIXME: typings
      .then(v => {
        if (!v || isNaN(v)) return 0

        return v
      })
  }

  static async listLocalExpired () {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        expiresOn: {
          [ Sequelize.Op.lt ]: new Date()
        }
      }
    }

    return VideoRedundancyModel.scope([ ScopeNames.WITH_VIDEO ]).findAll(query)
  }

  static async listRemoteExpired () {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: {
          [Sequelize.Op.ne]: actor.id
        },
        expiresOn: {
          [ Sequelize.Op.lt ]: new Date()
        }
      }
    }

    return VideoRedundancyModel.scope([ ScopeNames.WITH_VIDEO ]).findAll(query)
  }

  static async listLocalOfServer (serverId: number) {
    const actor = await getServerActor()
    const buildVideoInclude = () => ({
      model: VideoModel,
      required: true,
      include: [
        {
          attributes: [],
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [],
              model: ActorModel.unscoped(),
              required: true,
              where: {
                serverId
              }
            }
          ]
        }
      ]
    })

    const query = {
      where: {
        actorId: actor.id
      },
      include: [
        {
          model: VideoFileModel,
          required: false,
          include: [ buildVideoInclude() ]
        },
        {
          model: VideoStreamingPlaylistModel,
          required: false,
          include: [ buildVideoInclude() ]
        }
      ]
    }

    return VideoRedundancyModel.findAll(query)
  }

  static async getStats (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()

    const query = {
      raw: true,
      attributes: [
        [ Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoFile.size')), '0'), 'totalUsed' ],
        [ Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('videoId'))), 'totalVideos' ],
        [ Sequelize.fn('COUNT', Sequelize.col('videoFileId')), 'totalVideoFiles' ]
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

    return VideoRedundancyModel.findOne(query as any) // FIXME: typings
      .then((r: any) => ({
        totalUsed: parseInt(r.totalUsed.toString(), 10),
        totalVideos: r.totalVideos,
        totalVideoFiles: r.totalVideoFiles
      }))
  }

  getVideo () {
    if (this.VideoFile) return this.VideoFile.Video

    return this.VideoStreamingPlaylist.Video
  }

  isOwned () {
    return !!this.strategy
  }

  toActivityPubObject (): CacheFileObject {
    if (this.VideoStreamingPlaylist) {
      return {
        id: this.url,
        type: 'CacheFile' as 'CacheFile',
        object: this.VideoStreamingPlaylist.Video.url,
        expires: this.expiresOn.toISOString(),
        url: {
          type: 'Link',
          mimeType: 'application/x-mpegURL',
          mediaType: 'application/x-mpegURL',
          href: this.fileUrl
        }
      }
    }

    return {
      id: this.url,
      type: 'CacheFile' as 'CacheFile',
      object: this.VideoFile.Video.url,
      expires: this.expiresOn.toISOString(),
      url: {
        type: 'Link',
        mimeType: MIMETYPES.VIDEO.EXT_MIMETYPE[ this.VideoFile.extname ] as any,
        mediaType: MIMETYPES.VIDEO.EXT_MIMETYPE[ this.VideoFile.extname ] as any,
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
        `SELECT "videoFileId" FROM "videoRedundancy" WHERE "actorId" = ${actor.id} AND "videoFileId" IS NOT NULL` +
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
