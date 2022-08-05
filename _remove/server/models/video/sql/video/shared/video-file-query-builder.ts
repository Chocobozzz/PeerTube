import { Sequelize, Transaction } from 'sequelize'
import { AbstractVideoQueryBuilder } from './abstract-video-query-builder'

export type FileQueryOptions = {
  id?: string | number
  url?: string

  includeRedundancy: boolean

  transaction?: Transaction

  logging?: boolean
}

/**
 *
 * Fetch files (webtorrent and streaming playlist) according to a video
 *
 */

export class VideoFileQueryBuilder extends AbstractVideoQueryBuilder {
  protected attributes: { [key: string]: string }

  constructor (protected readonly sequelize: Sequelize) {
    super(sequelize, 'get')
  }

  queryWebTorrentVideos (options: FileQueryOptions) {
    this.buildWebtorrentFilesQuery(options)

    return this.runQuery(options)
  }

  queryStreamingPlaylistVideos (options: FileQueryOptions) {
    this.buildVideoStreamingPlaylistFilesQuery(options)

    return this.runQuery(options)
  }

  private buildWebtorrentFilesQuery (options: FileQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeWebtorrentFiles()

    if (options.includeRedundancy) {
      this.includeWebTorrentRedundancies()
    }

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildVideoStreamingPlaylistFilesQuery (options: FileQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeStreamingPlaylistFiles()

    if (options.includeRedundancy) {
      this.includeStreamingPlaylistRedundancies()
    }

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildQuery () {
    return `${this.buildSelect()} FROM "video" ${this.joins} ${this.where}`
  }
}
