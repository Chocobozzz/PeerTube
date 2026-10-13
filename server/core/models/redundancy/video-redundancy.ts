import { getAllPrivacies } from '@peertube/peertube-core-utils'
import {
  CacheFileObject,
  FileStorage,
  type FileStorageType,
  RedundancyInformation,
  VideoInclude,
  VideoPrivacy,
  VideoRedundanciesTarget,
  VideoRedundancy,
  VideoRedundancyStrategy,
  VideoRedundancyStrategyWithManual
} from '@peertube/peertube-models'
import { isTestInstance } from '@peertube/peertube-node-utils'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { removeRedundancyObjects } from '@server/lib/object-storage/redundancy.js'
import { getHLSRedundancyDirectory } from '@server/lib/paths.js'
import { getServerActor } from '@server/models/application/application.js'
import {
  MActor,
  MStreamingPlaylistVideo,
  MVideoForRedundancyAPI,
  MVideoRedundancy,
  MVideoRedundancyAP,
  MVideoRedundancyVideo
} from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import sample from 'lodash-es/sample.js'
import { literal, Op, QueryTypes, Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { ActorModel } from '../actor/actor.js'
import { ServerModel } from '../server/server.js'
import { getVideoSort, parseAggregateResult, SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { ScheduleVideoUpdateModel } from '../video/schedule-video-update.js'
import { VideoChannelModel } from '../video/video-channel.js'
import { VideoStreamingPlaylistModel } from '../video/video-streaming-playlist.js'
import { VideoModel } from '../video/video.js'

const logger = createLogger()

export enum ScopeNames {
  WITH_VIDEO = 'WITH_VIDEO'
}

@Scopes(() => ({
  [ScopeNames.WITH_VIDEO]: {
    include: [
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
      fields: [ 'videoStreamingPlaylistId' ]
    },
    {
      fields: [ 'actorId' ]
    },
    {
      fields: [ 'expiresOn' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoRedundancyModel extends SequelizeModel<VideoRedundancyModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(true)
  @Column
  declare expiresOn: Date

  @AllowNull(false)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max))
  declare fileUrl: string

  @AllowNull(false)
  @Is('VideoRedundancyUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max))
  declare url: string

  @AllowNull(true)
  @Column
  declare strategy: string // Only used by us

  // Where the files of our duplicated videos are, null for redundancies of other instances
  @AllowNull(true)
  @Column
  declare storage: FileStorageType

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @Column
  declare videoStreamingPlaylistId: number

  @BelongsTo(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare VideoStreamingPlaylist: Awaited<VideoStreamingPlaylistModel>

  @ForeignKey(() => ActorModel)
  @Column
  declare actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Actor: Awaited<ActorModel>

  @BeforeDestroy
  static async removeFiles (instance: VideoRedundancyModel, options: { transaction?: Transaction }) {
    if (!instance.isLocal()) return

    let playlist: MStreamingPlaylistVideo

    try {
      playlist = await VideoStreamingPlaylistModel.loadWithVideo(instance.videoStreamingPlaylistId, options.transaction)
    } catch (err) {
      logger.error('Cannot load streaming playlist of redundancy %d to remove its files.', instance.id, { err })
    }

    if (!playlist) return

    const video = playlist.Video
    const storage = instance.storage

    afterCommitIfTransaction(options.transaction, () => {
      logger.info('Removing duplicated video streaming playlist of video ' + video.uuid)

      const promise = storage === FileStorage.OBJECT_STORAGE
        ? removeRedundancyObjects(video)
        : remove(getHLSRedundancyDirectory(video))

      promise.catch(err => logger.error('Cannot delete duplicated video streaming playlist of video ' + video.uuid, { err }))
    })
  }

  static async listLocalByStreamingPlaylistId (videoStreamingPlaylistId: number): Promise<MVideoRedundancyVideo[]> {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        videoStreamingPlaylistId
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findAll(query)
  }

  static async listDuplicatedVideosNotInStorage (storage: FileStorageType): Promise<MVideoRedundancyVideo[]> {
    const actor = await getServerActor()

    const query = {
      where: {
        actorId: actor.id,
        storage: {
          [Op.ne]: storage
        }
      }
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findAll(query)
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

  static loadByIdWithVideo (id: number, transaction?: Transaction): Promise<MVideoRedundancyVideo> {
    const query = {
      where: { id },
      transaction
    }

    return VideoRedundancyModel.scope(ScopeNames.WITH_VIDEO).findOne(query)
  }

  static loadByUrl (url: string, transaction?: Transaction): Promise<MVideoRedundancy> {
    const query = {
      where: {
        url
      },
      transaction
    }

    return VideoRedundancyModel.findOne(query)
  }

  // ---------------------------------------------------------------------------
  // Select redundancy candidates
  // ---------------------------------------------------------------------------

  static async findMostViewToDuplicate (randomizedFactor: number) {
    const peertubeActor = await getServerActor()

    // On VideoModel!
    const query = {
      attributes: [ 'id', 'views' ],
      limit: randomizedFactor,
      order: getVideoSort('-views'),
      where: {
        ...this.buildVideoCandidateWhere(),
        ...this.buildVideoIdsForDuplication(peertubeActor)
      },
      include: [
        VideoRedundancyModel.buildRedundancyAllowedInclude(),
        VideoRedundancyModel.buildStreamingPlaylistRequiredInclude()
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async findTrendingToDuplicate (randomizedFactor: number) {
    const peertubeActor = await getServerActor()

    // On VideoModel!
    const query = {
      attributes: [ 'id', 'views' ],
      subQuery: false,
      group: 'VideoModel.id',
      limit: randomizedFactor,
      order: getVideoSort('-trending'),
      where: {
        ...this.buildVideoCandidateWhere(),
        ...this.buildVideoIdsForDuplication(peertubeActor)
      },
      include: [
        VideoRedundancyModel.buildRedundancyAllowedInclude(),
        VideoRedundancyModel.buildStreamingPlaylistRequiredInclude(),

        VideoModel.buildTrendingQuery(CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS)
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
  }

  static async findRecentlyAddedToDuplicate (randomizedFactor: number, minViews: number) {
    const peertubeActor = await getServerActor()

    // On VideoModel!
    const query = {
      attributes: [ 'id', 'publishedAt' ],
      limit: randomizedFactor,
      order: getVideoSort('-publishedAt'),
      where: {
        ...this.buildVideoCandidateWhere(),
        ...this.buildVideoIdsForDuplication(peertubeActor),

        views: {
          [Op.gte]: minViews
        }
      },
      include: [
        VideoRedundancyModel.buildRedundancyAllowedInclude(),
        VideoRedundancyModel.buildStreamingPlaylistRequiredInclude(),

        // Required by publishedAt sort
        {
          model: ScheduleVideoUpdateModel.unscoped(),
          required: false
        }
      ]
    }

    return VideoRedundancyModel.getVideoSample(VideoModel.unscoped().findAll(query))
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
          model: VideoStreamingPlaylistModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [],
              model: VideoModel.unscoped(),
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

  static async getVideoSample (p: Promise<VideoModel[]>) {
    const rows = await p
    if (rows.length === 0) return undefined

    const ids = rows.map(r => r.id)
    const id = sample(ids)

    return VideoModel.loadWithFiles(id, undefined, !isTestInstance())
  }

  private static buildVideoCandidateWhere () {
    return {
      privacy: VideoPrivacy.PUBLIC,
      remote: true,
      isLive: false
    }
  }

  private static buildRedundancyAllowedInclude () {
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

  private static buildStreamingPlaylistRequiredInclude () {
    return {
      attributes: [],
      required: true,
      model: VideoStreamingPlaylistModel.unscoped()
    }
  }

  // ---------------------------------------------------------------------------

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

  static async listLocalExpired (): Promise<MVideoRedundancyVideo[]> {
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

    const query = {
      where: {
        actorId: actor.id
      },
      include: [
        {
          model: VideoStreamingPlaylistModel.unscoped(),
          required: true,
          include: [
            {
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
            }
          ]
        }
      ]
    }

    return VideoRedundancyModel.findAll(query)
  }

  static async listForApi (options: {
    start: number
    count: number
    sort: string
    target: VideoRedundanciesTarget
    strategy?: string
  }) {
    const { start, count, sort, target, strategy } = options

    return VideoModel.listForApi({
      start,
      count,
      sort,
      nsfw: null,
      displayOnlyForFollower: null,

      include: VideoInclude.FILES | VideoInclude.BLACKLISTED | VideoInclude.NOT_PUBLISHED_STATE | VideoInclude.BLOCKED_OWNER,
      privacyOneOf: getAllPrivacies(),
      skipPrivateIncludeCheck: true,

      isLocal: target === 'my-videos',

      redundancyStrategy: strategy,
      localRedundancy: target === 'remote-videos'
        ? true
        : undefined,
      includeRedundancy: true,
      hasRedundancy: true,
      tableAttributes: {
        fullRedundancy: true
      }
    })
  }

  static async getStats (strategy: VideoRedundancyStrategyWithManual) {
    const actor = await getServerActor()

    const sql = `WITH "tmp" AS ` +
      `(` +
      `SELECT "videoStreamingFile"."size" AS "videoStreamingFileSize", "videoStreamingPlaylist"."videoId" AS "videoStreamingVideoId"` +
      `FROM "videoRedundancy" AS "videoRedundancy" ` +
      `LEFT JOIN "videoStreamingPlaylist" ON "videoRedundancy"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ` +
      `LEFT JOIN "videoFile" AS "videoStreamingFile" ` +
      `ON "videoStreamingPlaylist"."id" = "videoStreamingFile"."videoStreamingPlaylistId" ` +
      `WHERE "videoRedundancy"."strategy" = :strategy AND "videoRedundancy"."actorId" = :actorId` +
      `) ` +
      `SELECT ` +
      `COALESCE(SUM("videoStreamingFileSize"), '0') AS "totalUsed", ` +
      `COUNT(DISTINCT "videoStreamingVideoId") AS "totalVideos", ` +
      `COUNT(*) AS "totalVideoFiles" ` +
      `FROM "tmp"`

    return VideoRedundancyModel.sequelize.query<any>(sql, {
      replacements: { strategy, actorId: actor.id },
      type: QueryTypes.SELECT
    }).then(([ row ]) => ({
      totalUsed: parseAggregateResult(row.totalUsed),
      totalVideos: row.totalVideos,
      totalVideoFiles: row.totalVideoFiles
    }))
  }

  static async listVideoUUIDOfDuplicated (storage: FileStorageType) {
    const actor = await getServerActor()

    const sql = `SELECT DISTINCT "video"."uuid" ` +
      `FROM "videoRedundancy" ` +
      `INNER JOIN "videoStreamingPlaylist" ON "videoRedundancy"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ` +
      `INNER JOIN "video" ON "videoStreamingPlaylist"."videoId" = "video"."id" ` +
      `WHERE "videoRedundancy"."actorId" = :actorId AND "videoRedundancy"."storage" = :storage`

    const rows = await VideoRedundancyModel.sequelize.query<{ uuid: string }>(sql, {
      replacements: { actorId: actor.id, storage },
      type: QueryTypes.SELECT
    })

    return new Set(rows.map(r => r.uuid))
  }

  static toFormattedJSONStatic (video: MVideoForRedundancyAPI): VideoRedundancy {
    const streamingPlaylistsRedundancies: RedundancyInformation[] = []

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
        streamingPlaylists: streamingPlaylistsRedundancies
      }
    }
  }

  getVideo () {
    return this.VideoStreamingPlaylist.Video
  }

  getVideoUUID () {
    return this.getVideo()?.uuid
  }

  isLocal () {
    return !!this.strategy
  }

  toActivityPubObject (this: MVideoRedundancyAP): CacheFileObject {
    return {
      id: this.url,
      type: 'CacheFile',
      object: this.VideoStreamingPlaylist.Video.url,
      expires: this.expiresOn ? this.expiresOn.toISOString() : null,
      url: {
        type: 'Link',
        mediaType: 'application/x-mpegURL',
        href: this.fileUrl
      }
    }
  }

  // Don't include video files we already duplicated
  private static buildVideoIdsForDuplication (peertubeActor: MActor) {
    const notIn = literal(
      '(' +
        `SELECT "videoStreamingPlaylist"."videoId" AS "videoId" FROM "videoRedundancy" ` +
        `INNER JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist"."id" = "videoRedundancy"."videoStreamingPlaylistId" ` +
        `WHERE "videoRedundancy"."actorId" = ${peertubeActor.id} ` +
        ')'
    )

    return {
      id: {
        [Op.notIn]: notIn
      }
    }
  }
}
