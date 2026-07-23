import { Sequelize, Transaction } from 'sequelize'
import { AbstractVideoQueryBuilder } from './abstract-video-query-builder.js'
import { TableAttributeOptions } from './table-attributes-options.model.js'

export type FileQueryOptions = {
  id?: string | number
  url?: string

  includeRedundancy: boolean
  includeInfohashes: boolean

  transaction?: Transaction

  logging?: boolean

  tableAttributes?: TableAttributeOptions
}

/**
 * Fetch files (web videos and streaming playlist) according to a video
 */

export class VideoFileQueryBuilder extends AbstractVideoQueryBuilder {
  constructor (protected readonly sequelize: Sequelize) {
    super(sequelize, 'get')
  }

  queryWebVideos (options: FileQueryOptions) {
    this.buildWebVideoFilesQuery(options)

    return this.runQuery(options)
  }

  queryStreamingPlaylistVideos (options: FileQueryOptions) {
    this.buildVideoStreamingPlaylistFilesQuery(options)

    return this.runQuery(options)
  }

  private buildWebVideoFilesQuery (options: FileQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeWebVideoFiles(options.includeInfohashes)

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildVideoStreamingPlaylistFilesQuery (options: FileQueryOptions) {
    this.attributes = {
      '"video"."id"': ''
    }

    this.includeStreamingPlaylistFiles(options.includeInfohashes)

    if (options.includeRedundancy) {
      this.includeStreamingPlaylistRedundancies(options.tableAttributes)
    }

    this.whereId(options)

    this.query = this.buildQuery()
  }

  private buildQuery () {
    return `${this.buildSelect()} FROM "video" ${this.joins} ${this.where}`
  }
}
