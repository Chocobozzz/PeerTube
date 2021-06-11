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

export type BuildVideoGetQueryOptions = {
  id?: number | string
  url?: string

  type: 'api' | 'full-light' | 'account-blacklist-files' | 'all-files' | 'thumbnails' | 'thumbnails-blacklist' | 'id' | 'blacklist-rights'

  userId?: number
  transaction?: Transaction

  logging?: boolean
}

export class VideosModelGetQueryBuilder {
  videoQueryBuilder: VideosModelGetQuerySubBuilder
  webtorrentFilesQueryBuilder: VideoFileQueryBuilder
  streamingPlaylistFilesQueryBuilder: VideoFileQueryBuilder

  private readonly videoModelBuilder: VideoModelBuilder

  constructor (protected readonly sequelize: Sequelize) {
    this.videoQueryBuilder = new VideosModelGetQuerySubBuilder(sequelize)
    this.webtorrentFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)
    this.streamingPlaylistFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)

    this.videoModelBuilder = new VideoModelBuilder('get', new VideoTables('get'))
  }

  async queryVideo (options: BuildVideoGetQueryOptions) {
    const [ videoRows, webtorrentFilesRows, streamingPlaylistFilesRows ] = await Promise.all([
      this.videoQueryBuilder.queryVideos(options),

      this.shouldQueryVideoFiles(options)
        ? this.webtorrentFilesQueryBuilder.queryWebTorrentVideos(options)
        : Promise.resolve(undefined),

      this.shouldQueryVideoFiles(options)
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

  private shouldQueryVideoFiles (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light', 'account-blacklist-files', 'all-files' ].includes(options.type)
  }
}

export class VideosModelGetQuerySubBuilder extends AbstractVideosModelQueryBuilder {
  protected attributes: { [key: string]: string }

  protected webtorrentFilesQuery: string
  protected streamingPlaylistFilesQuery: string

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

    if (this.shouldIncludeThumbnails(options)) {
      this.includeThumbnails()
    }

    if (this.shouldIncludeBlacklisted(options)) {
      this.includeBlacklisted()
    }

    if (this.shouldIncludeAccount(options)) {
      this.includeChannels()
      this.includeAccounts()
    }

    if (this.shouldIncludeTags(options)) {
      this.includeTags()
    }

    if (this.shouldIncludeScheduleUpdate(options)) {
      this.includeScheduleUpdate()
    }

    if (this.shouldIncludeLive(options)) {
      this.includeLive()
    }

    if (options.userId && this.shouldIncludeUserHistory(options)) {
      this.includeUserHistory(options.userId)
    }

    if (this.shouldIncludeOwnerUser(options)) {
      this.includeOwnerUser()
    }

    if (this.shouldIncludeTrackers(options)) {
      this.includeTrackers()
    }

    this.whereId(options)

    this.query = this.buildQuery(options)
  }

  private buildQuery (options: BuildVideoGetQueryOptions) {
    const order = this.shouldIncludeTags(options)
      ? 'ORDER BY "Tags"."name" ASC'
      : ''

    const from = `SELECT * FROM "video" ${this.where} LIMIT 1`

    return `${this.buildSelect()} FROM (${from}) AS "video" ${this.joins} ${order}`
  }

  private shouldIncludeTrackers (options: BuildVideoGetQueryOptions) {
    return options.type === 'api'
  }

  private shouldIncludeLive (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light' ].includes(options.type)
  }

  private shouldIncludeScheduleUpdate (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light' ].includes(options.type)
  }

  private shouldIncludeTags (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light' ].includes(options.type)
  }

  private shouldIncludeUserHistory (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light' ].includes(options.type)
  }

  private shouldIncludeAccount (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light', 'account-blacklist-files' ].includes(options.type)
  }

  private shouldIncludeBlacklisted (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light', 'account-blacklist-files', 'thumbnails-blacklist', 'blacklist-rights' ].includes(options.type)
  }

  private shouldIncludeOwnerUser (options: BuildVideoGetQueryOptions) {
    return options.type === 'blacklist-rights'
  }

  private shouldIncludeThumbnails (options: BuildVideoGetQueryOptions) {
    return [ 'api', 'full-light', 'account-blacklist-files', 'thumbnails', 'thumbnails-blacklist' ].includes(options.type)
  }
}
