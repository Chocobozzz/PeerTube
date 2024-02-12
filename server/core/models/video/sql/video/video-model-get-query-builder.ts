import { Sequelize, Transaction } from 'sequelize'
import { pick } from '@peertube/peertube-core-utils'
import { AbstractVideoQueryBuilder } from './shared/abstract-video-query-builder.js'
import { VideoFileQueryBuilder } from './shared/video-file-query-builder.js'
import { VideoModelBuilder } from './shared/video-model-builder.js'
import { VideoTableAttributes } from './shared/video-table-attributes.js'

/**
 *
 * Build a GET SQL query, fetch rows and create the video model
 *
 */

export type GetType =
  'api' |
  'full' |
  'account-blacklist-files' |
  'account' |
  'all-files' |
  'thumbnails' |
  'thumbnails-blacklist' |
  'id' |
  'blacklist-rights'

export type BuildVideoGetQueryOptions = {
  id?: number | string
  url?: string

  type: GetType

  userId?: number
  transaction?: Transaction

  logging?: boolean
}

export class VideoModelGetQueryBuilder {
  videoQueryBuilder: VideosModelGetQuerySubBuilder
  webVideoFilesQueryBuilder: VideoFileQueryBuilder
  streamingPlaylistFilesQueryBuilder: VideoFileQueryBuilder

  private readonly videoModelBuilder: VideoModelBuilder

  private static readonly videoFilesInclude = new Set<GetType>([ 'api', 'full', 'account-blacklist-files', 'all-files' ])

  constructor (protected readonly sequelize: Sequelize) {
    this.videoQueryBuilder = new VideosModelGetQuerySubBuilder(sequelize)
    this.webVideoFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)
    this.streamingPlaylistFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)

    this.videoModelBuilder = new VideoModelBuilder('get', new VideoTableAttributes('get'))
  }

  async queryVideo (options: BuildVideoGetQueryOptions) {
    const fileQueryOptions = {
      ...pick(options, [ 'id', 'url', 'transaction', 'logging' ]),

      includeRedundancy: this.shouldIncludeRedundancies(options)
    }

    const [ videoRows, webVideoFilesRows, streamingPlaylistFilesRows ] = await Promise.all([
      this.videoQueryBuilder.queryVideos(options),

      VideoModelGetQueryBuilder.videoFilesInclude.has(options.type)
        ? this.webVideoFilesQueryBuilder.queryWebVideos(fileQueryOptions)
        : Promise.resolve(undefined),

      VideoModelGetQueryBuilder.videoFilesInclude.has(options.type)
        ? this.streamingPlaylistFilesQueryBuilder.queryStreamingPlaylistVideos(fileQueryOptions)
        : Promise.resolve(undefined)
    ])

    const videos = this.videoModelBuilder.buildVideosFromRows({
      rows: videoRows,
      rowsWebVideoFiles: webVideoFilesRows,
      rowsStreamingPlaylist: streamingPlaylistFilesRows
    })

    if (videos.length > 1) {
      throw new Error('Video results is more than 1')
    }

    if (videos.length === 0) return null

    return videos[0]
  }

  private shouldIncludeRedundancies (options: BuildVideoGetQueryOptions) {
    return options.type === 'api'
  }
}

export class VideosModelGetQuerySubBuilder extends AbstractVideoQueryBuilder {
  protected attributes: { [key: string]: string }

  protected webVideoFilesQuery: string
  protected streamingPlaylistFilesQuery: string

  private static readonly trackersInclude = new Set<GetType>([ 'api' ])
  private static readonly liveInclude = new Set<GetType>([ 'api', 'full' ])
  private static readonly scheduleUpdateInclude = new Set<GetType>([ 'api', 'full' ])
  private static readonly tagsInclude = new Set<GetType>([ 'api', 'full' ])
  private static readonly userHistoryInclude = new Set<GetType>([ 'api', 'full' ])
  private static readonly accountInclude = new Set<GetType>([ 'api', 'full', 'account', 'account-blacklist-files' ])
  private static readonly ownerUserInclude = new Set<GetType>([ 'blacklist-rights' ])

  private static readonly blacklistedInclude = new Set<GetType>([
    'api',
    'full',
    'account-blacklist-files',
    'thumbnails-blacklist',
    'blacklist-rights'
  ])

  private static readonly thumbnailsInclude = new Set<GetType>([
    'api',
    'full',
    'account-blacklist-files',
    'all-files',
    'thumbnails',
    'thumbnails-blacklist'
  ])

  constructor (protected readonly sequelize: Sequelize) {
    super(sequelize, 'get')
  }

  queryVideos (options: BuildVideoGetQueryOptions) {
    this.buildMainGetQuery(options)

    return this.runQuery(options)
  }

  private buildMainGetQuery (options: BuildVideoGetQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    if (VideosModelGetQuerySubBuilder.thumbnailsInclude.has(options.type)) {
      this.includeThumbnails()
    }

    if (VideosModelGetQuerySubBuilder.blacklistedInclude.has(options.type)) {
      this.includeBlacklisted()
    }

    if (VideosModelGetQuerySubBuilder.accountInclude.has(options.type)) {
      this.includeChannels()
      this.includeAccounts()
    }

    if (VideosModelGetQuerySubBuilder.tagsInclude.has(options.type)) {
      this.includeTags()
    }

    if (VideosModelGetQuerySubBuilder.scheduleUpdateInclude.has(options.type)) {
      this.includeScheduleUpdate()
    }

    if (VideosModelGetQuerySubBuilder.liveInclude.has(options.type)) {
      this.includeLive()
    }

    if (options.userId && VideosModelGetQuerySubBuilder.userHistoryInclude.has(options.type)) {
      this.includeUserHistory(options.userId)
    }

    if (VideosModelGetQuerySubBuilder.ownerUserInclude.has(options.type)) {
      this.includeOwnerUser()
    }

    if (VideosModelGetQuerySubBuilder.trackersInclude.has(options.type)) {
      this.includeTrackers()
    }

    this.whereId(options)

    this.query = this.buildQuery(options)
  }

  private buildQuery (options: BuildVideoGetQueryOptions) {
    const order = VideosModelGetQuerySubBuilder.tagsInclude.has(options.type)
      ? 'ORDER BY "Tags"."name" ASC'
      : ''

    const from = `SELECT * FROM "video" ${this.where} LIMIT 1`

    return `${this.buildSelect()} FROM (${from}) AS "video" ${this.joins} ${order}`
  }
}
