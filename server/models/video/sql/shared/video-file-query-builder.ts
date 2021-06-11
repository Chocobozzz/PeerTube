import { Sequelize } from 'sequelize'
import { BuildVideoGetQueryOptions } from '../video-model-get-query-builder'
import { AbstractVideosModelQueryBuilder } from './abstract-videos-model-query-builder'

/**
 *
 * Fetch files (webtorrent and streaming playlist) according to a video
 *
 */

export class VideoFileQueryBuilder extends AbstractVideosModelQueryBuilder {
  protected attributes: { [key: string]: string }

  constructor (protected readonly sequelize: Sequelize) {
    super('get')
  }

  queryWebTorrentVideos (options: BuildVideoGetQueryOptions) {
    this.buildWebtorrentFilesQuery(options)

    return this.runQuery(options)
  }

  queryStreamingPlaylistVideos (options: BuildVideoGetQueryOptions) {
    this.buildVideoStreamingPlaylistFilesQuery(options)

    return this.runQuery(options)
  }

  private buildWebtorrentFilesQuery (options: BuildVideoGetQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeWebtorrentFiles()

    if (this.shouldIncludeRedundancies(options)) {
      this.includeWebTorrentRedundancies()
    }

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildVideoStreamingPlaylistFilesQuery (options: BuildVideoGetQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeStreamingPlaylistFiles()

    if (this.shouldIncludeRedundancies(options)) {
      this.includeStreamingPlaylistRedundancies()
    }

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildQuery () {
    return `${this.buildSelect()} FROM "video" ${this.joins} ${this.where}`
  }

  private shouldIncludeRedundancies (options: BuildVideoGetQueryOptions) {
    return options.type === 'api'
  }
}
