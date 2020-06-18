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
import { getSort, getVideoSort, parseAggregateResult, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid, isUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../initializers/constants'
import { VideoFileModel } from '../video/video-file'
import { VideoModel } from '../video/video'
import { VideoRedundancyStrategy, VideoRedundancyStrategyWithManual } from '../../../shared/models/redundancy'
import { logger } from '../../helpers/logger'
import { CacheFileObject, VideoPrivacy } from '../../../shared'
import { VideoChannelModel } from '../video/video-channel'
import { ServerModel } from '../server/server'
import { sample } from 'lodash'
import { isTestInstance } from '../../helpers/core-utils'
import * as Bluebird from 'bluebird'
import { col, FindOptions, fn, literal, Op, Transaction, WhereOptions } from 'sequelize'
import { VideoStreamingPlaylistModel } from '../video/video-streaming-playlist'
import { CONFIG } from '../../initializers/config'
import { MVideoForRedundancyAPI, MVideoRedundancy, MVideoRedundancyAP, MVideoRedundancyVideo } from '@server/types/models'
import { VideoRedundanciesTarget } from '@shared/models/redundancy/video-redundancies-filters.model'
import {
  FileRedundancyInformation,
  StreamingPlaylistRedundancyInformation,
  VideoRedundancy
} from '@shared/models/redundancy/video-redundancy.model'
import { getServerActor } from '@server/models/application/application'

export enum ScopeNames {
  WITH_VIDEO = 'WITH_VIDEO'
}

@Scopes(() => ({
  [ScopeNames.WITH_VIDEO]: {
    include: [
      {
        model: VideoFileModel,
        required: false,
        include: [
          {
            model: VideoModel,
            required: true
          }
        ]
      },
      {
        model: VideoStreamingPlaylistModel,
        required: false,
        include: [
          {
            model: VideoModel,
            required: true
          }
        ]
      }
    ]
  }
}))

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

  @AllowNull(true)
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

      videoStreamingPlaylist.Video.removeStreamingPlaylistFiles(videoStreamingPlaylist, true)
                            .catch(err => logger.error('Cannot delete video streaming playlist files of %s.', videoUUID, { err }))
    }

    return undefined
  }

  static async loadLocalByFileId (videoFileId: number): Promise<MVideoRedundancyVideo> {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        videoFileId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static async loadLocalByStreamingPlaylistId (videoStreamingPlaylistId: number): Promise<MVideoRedundancyVideo> {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        videoStreamingPlaylistId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static loadByIdWithVideo (id: number, transaction?: Transaction): Bluebird<MVideoRedundancyVideo> {
    const query = {
      where: { id },
      transaction
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static loadByUrl (url: string, transaction?: Transaction): Bluebird<MVideoRedundancy> {
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
          attributes: [],
          model: VideoFileModel,
          required: true,
          include: [
            {
              attributes: [],
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
    if (rows.length === 0) return undefined

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
          [Op.gte]: minViews
        }
      },
      include: [
        await VideoRedundancyModel.buildVideoFileForDuplication(),
        VideoRedundancyModel.buildServerRedundancyInclude()
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async loadOldestLocalExpired (strategy: VideoRedundancyStrategy, expiresAfterMs: number): Promise<MVideoRedundancyVideo> {
    const expiredDate = new Date()
    expiredDate.setMilliseconds(expiredDate.getMilliseconds() - expiresAfterMs)

    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        strategy,
        createdAt: {
          [Op.lt]: expiredDate
        }
      }
    }

    return VideoRedundancyModel.scope([ ScopeNames.WITH_VIDEO ]).findOne(query)
  }

  static async getTotalDuplicated (strategy: VideoRedundancyStrategy) {
    const actor = await getServerActor()
    const redundancyInclude = {
      attributes: [],
      model: VideoRedundancyModel,
      required: true,
      where: {
        actorId: actor.id,
        strategy
      }
    }

    const queryFiles: FindOptions = {
      include: [ redundancyInclude ]
    }

    const queryStreamingPlaylists: FindOptions = {
      include: [
        {
          attributes: [],
          model: VideoModel.unscoped(),
          required: true,
          include: [
            {
              required: true,
              attributes: [],
              model: VideoStreamingPlaylistModel.unscoped(),
              include: [
                redundancyInclude
              ]
            }
          ]
        }
      ]
    }

    return Promise.all([
      VideoFileModel.aggregate('size', 'SUM', queryFiles),
      VideoFileModel.aggregate('size', 'SUM', queryStreamingPlaylists)
    ]).then(([ r1, r2 ]) => {
      return parseAggregateResult(r1) + parseAggregateResult(r2)
    })
  }

  static async listLocalExpired () {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        expiresOn: {
          [Op.lt]: new Date()
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
          [Op.ne]: actor.id
        },
        expiresOn: {
          [Op.lt]: new Date(),
          [Op.ne]: null
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

  static listForApi (options: {
    start: number
    count: number
    sort: string
    target: VideoRedundanciesTarget
    strategy?: string
  }) {
    const { start, count, sort, target, strategy } = options
    const redundancyWhere: WhereOptions = {}
    const videosWhere: WhereOptions = {}
    let redundancySqlSuffix = ''

    if (target === 'my-videos') {
      Object.assign(videosWhere, { remote: false })
    } else if (target === 'remote-videos') {
      Object.assign(videosWhere, { remote: true })
      Object.assign(redundancyWhere, { strategy: { [Op.ne]: null } })
      redundancySqlSuffix = ' AND "videoRedundancy"."strategy" IS NOT NULL'
    }

    if (strategy) {
      Object.assign(redundancyWhere, { strategy: strategy })
    }

    const videoFilterWhere = {
      [Op.and]: [
        {
          [Op.or]: [
            {
              id: {
                [Op.in]: literal(
                  '(' +
                  'SELECT "videoId" FROM "videoFile" ' +
                  'INNER JOIN "videoRedundancy" ON "videoRedundancy"."videoFileId" = "videoFile".id' +
                  redundancySqlSuffix +
                  ')'
                )
              }
            },
            {
              id: {
                [Op.in]: literal(
                  '(' +
                  'select "videoId" FROM "videoStreamingPlaylist" ' +
                  'INNER JOIN "videoRedundancy" ON "videoRedundancy"."videoStreamingPlaylistId" = "videoStreamingPlaylist".id' +
                  redundancySqlSuffix +
                  ')'
                )
              }
            }
          ]
        },

        videosWhere
      ]
    }

    // /!\ On video model /!\
    const findOptions = {
      offset: start,
      limit: count,
      order: getSort(sort),
      include: [
        {
          required: false,
          model: VideoFileModel,
          include: [
            {
              model: VideoRedundancyModel.unscoped(),
              required: false,
              where: redundancyWhere
            }
          ]
        },
        {
          required: false,
          model: VideoStreamingPlaylistModel.unscoped(),
          include: [
            {
              model: VideoRedundancyModel.unscoped(),
              required: false,
              where: redundancyWhere
            },
            {
              model: VideoFileModel,
              required: false
            }
          ]
        }
      ],
      where: videoFilterWhere
    }

    // /!\ On video model /!\
    const countOptions = {
      where: videoFilterWhere
    }

    return Promise.all([
      VideoModel.findAll(findOptions),

      VideoModel.count(countOptions)
    ]).then(([ data, total ]) => ({ total, data }))
  }

  static async getStats (strategy: VideoRedundancyStrategyWithManual) {
    const actor = await getServerActor()

    const query: FindOptions = {
      raw: true,
      attributes: [
        [ fn('COALESCE', fn('SUM', col('VideoFile.size')), '0'), 'totalUsed' ],
        [ fn('COUNT', fn('DISTINCT', col('videoId'))), 'totalVideos' ],
        [ fn('COUNT', col('videoFileId')), 'totalVideoFiles' ]
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

    return VideoRedundancyModel.findOne(query)
                               .then((r: any) => ({
                                 totalUsed: parseAggregateResult(r.totalUsed),
                                 totalVideos: r.totalVideos,
                                 totalVideoFiles: r.totalVideoFiles
                               }))
  }

  static toFormattedJSONStatic (video: MVideoForRedundancyAPI): VideoRedundancy {
    const filesRedundancies: FileRedundancyInformation[] = []
    const streamingPlaylistsRedundancies: StreamingPlaylistRedundancyInformation[] = []

    for (const file of video.VideoFiles) {
      for (const redundancy of file.RedundancyVideos) {
        filesRedundancies.push({
          id: redundancy.id,
          fileUrl: redundancy.fileUrl,
          strategy: redundancy.strategy,
          createdAt: redundancy.createdAt,
          updatedAt: redundancy.updatedAt,
          expiresOn: redundancy.expiresOn,
          size: file.size
        })
      }
    }

    for (const playlist of video.VideoStreamingPlaylists) {
      const size = playlist.VideoFiles.reduce((a, b) => a + b.size, 0)

      for (const redundancy of playlist.RedundancyVideos) {
        streamingPlaylistsRedundancies.push({
          id: redundancy.id,
          fileUrl: redundancy.fileUrl,
          strategy: redundancy.strategy,
          createdAt: redundancy.createdAt,
          updatedAt: redundancy.updatedAt,
          expiresOn: redundancy.expiresOn,
          size
        })
      }
    }

    return {
      id: video.id,
      name: video.name,
      url: video.url,
      uuid: video.uuid,

      redundancies: {
        files: filesRedundancies,
        streamingPlaylists: streamingPlaylistsRedundancies
      }
    }
  }

  getVideo () {
    if (this.VideoFile) return this.VideoFile.Video

    return this.VideoStreamingPlaylist.Video
  }

  isOwned () {
    return !!this.strategy
  }

  toActivityPubObject (this: MVideoRedundancyAP): CacheFileObject {
    if (this.VideoStreamingPlaylist) {
      return {
        id: this.url,
        type: 'CacheFile' as 'CacheFile',
        object: this.VideoStreamingPlaylist.Video.url,
        expires: this.expiresOn ? this.expiresOn.toISOString() : null,
        url: {
          type: 'Link',
          mediaType: 'application/x-mpegURL',
          href: this.fileUrl
        }
      }
    }

    return {
      id: this.url,
      type: 'CacheFile' as 'CacheFile',
      object: this.VideoFile.Video.url,
      expires: this.expiresOn ? this.expiresOn.toISOString() : null,
      url: {
        type: 'Link',
        mediaType: MIMETYPES.VIDEO.EXT_MIMETYPE[this.VideoFile.extname] as any,
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

    const notIn = literal(
      '(' +
      `SELECT "videoFileId" FROM "videoRedundancy" WHERE "actorId" = ${actor.id} AND "videoFileId" IS NOT NULL` +
      ')'
    )

    return {
      attributes: [],
      model: VideoFileModel,
      required: true,
      where: {
        id: {
          [Op.notIn]: notIn
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
