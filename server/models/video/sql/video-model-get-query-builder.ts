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
  id: number | string
  transaction?: Transaction
  userId?: number
  forGetAPI?: boolean
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

  async queryVideos (options: BuildVideoGetQueryOptions) {
    const [ videoRows, webtorrentFilesRows, streamingPlaylistFilesRows ] = await Promise.all([
      this.videoQueryBuilder.queryVideos(options),
      this.webtorrentFilesQueryBuilder.queryWebTorrentVideos(options),
      this.streamingPlaylistFilesQueryBuilder.queryStreamingPlaylistVideos(options)
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
  protected joins: string[] = []

  protected webtorrentFilesQuery: string
  protected streamingPlaylistFilesQuery: string

  constructor (protected readonly sequelize: Sequelize) {
    super('get')
  }

  queryVideos (options: BuildVideoGetQueryOptions) {
    this.buildMainGetQuery(options)

    return this.runQuery(options.transaction)
  }

  private buildMainGetQuery (options: BuildVideoGetQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    this.includeChannels()
    this.includeAccounts()

    this.includeTags()

    this.includeThumbnails()

    this.includeBlacklisted()

    this.includeScheduleUpdate()

    this.includeLive()

    if (options.userId) {
      this.includeUserHistory(options.userId)
    }

    if (options.forGetAPI === true) {
      this.includeTrackers()
    }

    this.whereId(options.id)

    this.query = this.buildQuery()
  }

  private buildQuery () {
    const order = 'ORDER BY "Tags"."name" ASC'
    const from = `SELECT * FROM "video" ${this.where} LIMIT 1`

    return `${this.buildSelect()} FROM (${from}) AS "video" ${this.joins.join(' ')} ${order}`
  }
}
