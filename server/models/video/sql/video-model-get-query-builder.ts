import { Sequelize, Transaction } from 'sequelize'
import { AbstractVideosModelQueryBuilder } from './shared/abstract-videos-model-query-builder'
import { VideoFileQueryBuilder } from './shared/video-file-query-builder'
import { VideoModelBuilder } from './shared/video-model-builder'
import { VideoTables } from './shared/video-tables'

/**
 *
 * Build a GET SQL query, fetch rows and create the video model
 *
 */

export type GetType =
  'api' |
  'full-light' |
  'account-blacklist-files' |
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

export class VideosModelGetQueryBuilder {
  videoQueryBuilder: VideosModelGetQuerySubBuilder
  webtorrentFilesQueryBuilder: VideoFileQueryBuilder
  streamingPlaylistFilesQueryBuilder: VideoFileQueryBuilder

  private readonly videoModelBuilder: VideoModelBuilder

  private static readonly videoFilesInclude = new Set<GetType>([ 'api', 'full-light', 'account-blacklist-files', 'all-files' ])

  constructor (protected readonly sequelize: Sequelize) {
    this.videoQueryBuilder = new VideosModelGetQuerySubBuilder(sequelize)
    this.webtorrentFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)
    this.streamingPlaylistFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)

    this.videoModelBuilder = new VideoModelBuilder('get', new VideoTables('get'))
  }

  async queryVideo (options: BuildVideoGetQueryOptions) {
    const [ videoRows, webtorrentFilesRows, streamingPlaylistFilesRows ] = await Promise.all([
      this.videoQueryBuilder.queryVideos(options),

      VideosModelGetQueryBuilder.videoFilesInclude.has(options.type)
        ? this.webtorrentFilesQueryBuilder.queryWebTorrentVideos(options)
        : Promise.resolve(undefined),

      VideosModelGetQueryBuilder.videoFilesInclude.has(options.type)
        ? this.streamingPlaylistFilesQueryBuilder.queryStreamingPlaylistVideos(options)
        : Promise.resolve(undefined)
    ])

    const videos = this.videoModelBuilder.buildVideosFromRows(videoRows, webtorrentFilesRows, streamingPlaylistFilesRows)

    if (videos.length > 1) {
      throw new Error('Video results is more than ')
    }

    if (videos.length === 0) return null
    return videos[0]
  }
}

export class VideosModelGetQuerySubBuilder extends AbstractVideosModelQueryBuilder {
  protected attributes: { [key: string]: string }

  protected webtorrentFilesQuery: string
  protected streamingPlaylistFilesQuery: string

  private static readonly trackersInclude = new Set<GetType>([ 'api' ])
  private static readonly liveInclude = new Set<GetType>([ 'api', 'full-light' ])
  private static readonly scheduleUpdateInclude = new Set<GetType>([ 'api', 'full-light' ])
  private static readonly tagsInclude = new Set<GetType>([ 'api', 'full-light' ])
  private static readonly userHistoryInclude = new Set<GetType>([ 'api', 'full-light' ])
  private static readonly accountInclude = new Set<GetType>([ 'api', 'full-light', 'account-blacklist-files' ])
  private static readonly ownerUserInclude = new Set<GetType>([ 'blacklist-rights' ])

  private static readonly blacklistedInclude = new Set<GetType>([
    'api',
    'full-light',
    'account-blacklist-files',
    'thumbnails-blacklist',
    'blacklist-rights'
  ])

  private static readonly thumbnailsInclude = new Set<GetType>([
    'api',
    'full-light',
    'account-blacklist-files',
    'all-files',
    'thumbnails',
    'thumbnails-blacklist'
  ])

  constructor (protected readonly sequelize: Sequelize) {
    super('get')
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
