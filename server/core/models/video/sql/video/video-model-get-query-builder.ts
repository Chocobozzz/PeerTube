import { pick } from '@peertube/peertube-core-utils'
import { Sequelize, Transaction } from 'sequelize'
import { AbstractVideoQueryBuilder } from './shared/abstract-video-query-builder.js'
import { VideoFileQueryBuilder } from './shared/video-file-query-builder.js'
import { VideoModelBuilder } from './shared/video-model-builder.js'
import { VideoTableAttributes } from './shared/video-table-attributes.js'

/**
 * Build a GET SQL query, fetch rows and create the video model
 */

export type GetType =
  | 'api'
  | 'full'
  | 'account-blacklist-files'
  | 'account'
  | 'all-files'
  | 'thumbnails'
  | 'thumbnails-blacklist'
  | 'id'
  | 'blacklist-rights'
  | 'seo'

const videoFilesInclude = new Set<GetType>([ 'api', 'full', 'account-blacklist-files', 'all-files' ])
const captionsInclude = new Set<GetType>([ 'seo' ])

const trackersInclude = new Set<GetType>([ 'api' ])
const liveInclude = new Set<GetType>([ 'api', 'full' ])
const scheduleUpdateInclude = new Set<GetType>([ 'api', 'full' ])
const tagsInclude = new Set<GetType>([ 'api', 'full', 'seo' ])
const userHistoryInclude = new Set<GetType>([ 'api', 'full' ])
const accountInclude = new Set<GetType>([ 'api', 'full', 'account', 'account-blacklist-files', 'seo' ])
const ownerUserInclude = new Set<GetType>([ 'blacklist-rights' ])

const blacklistedInclude = new Set<GetType>([
  'api',
  'full',
  'account-blacklist-files',
  'thumbnails-blacklist',
  'blacklist-rights',
  'seo'
])

const thumbnailsInclude = new Set<GetType>([
  'api',
  'full',
  'account-blacklist-files',
  'all-files',
  'thumbnails',
  'thumbnails-blacklist',
  'seo'
])

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

      videoFilesInclude.has(options.type)
        ? this.webVideoFilesQueryBuilder.queryWebVideos(fileQueryOptions)
        : Promise.resolve(undefined),

      videoFilesInclude.has(options.type)
        ? this.streamingPlaylistFilesQueryBuilder.queryStreamingPlaylistVideos(fileQueryOptions)
        : Promise.resolve(undefined)
    ])

    const videos = this.videoModelBuilder.buildVideosFromRows({
      rows: videoRows,
      addCaptions: captionsInclude.has(options.type),
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
  protected webVideoFilesQuery: string
  protected streamingPlaylistFilesQuery: string

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

    if (thumbnailsInclude.has(options.type)) {
      this.includeThumbnails()
    }

    if (blacklistedInclude.has(options.type)) {
      this.includeBlacklisted()
    }

    if (accountInclude.has(options.type)) {
      this.includeChannels()
      this.includeAccounts()
    }

    if (tagsInclude.has(options.type)) {
      this.includeTags()
    }

    if (scheduleUpdateInclude.has(options.type)) {
      this.includeScheduleUpdate()
    }

    if (liveInclude.has(options.type)) {
      this.includeLive()
      this.includeLiveSchedules()
    }

    if (options.userId && userHistoryInclude.has(options.type)) {
      this.includeUserHistory(options.userId)
    }

    if (ownerUserInclude.has(options.type)) {
      this.includeOwnerUser()
    }

    if (trackersInclude.has(options.type)) {
      this.includeTrackers()
    }

    if (captionsInclude.has(options.type)) {
      this.includeCaptions()
    }

    this.whereId(options)

    this.query = this.buildQuery(options)
  }

  private buildQuery (options: BuildVideoGetQueryOptions) {
    const order = tagsInclude.has(options.type)
      ? 'ORDER BY "Tags"."name" ASC'
      : ''

    const from = `SELECT * FROM "video" ${this.where} LIMIT 1`

    return `${this.buildSelect()} FROM (${from}) AS "video" ${this.joins} ${order}`
  }
}
