import { Sequelize } from 'sequelize'
import { pick } from '@shared/core-utils'
import { VideoInclude } from '@shared/models'
import { AbstractVideoQueryBuilder } from './shared/abstract-video-query-builder'
import { VideoFileQueryBuilder } from './shared/video-file-query-builder'
import { VideoModelBuilder } from './shared/video-model-builder'
import { BuildVideosListQueryOptions, VideosIdListQueryBuilder } from './videos-id-list-query-builder'

/**
 *
 * Build videos list SQL query and create video models
 *
 */

export class VideosModelListQueryBuilder extends AbstractVideoQueryBuilder {
  protected attributes: { [key: string]: string }

  private innerQuery: string
  private innerSort: string

  webVideoFilesQueryBuilder: VideoFileQueryBuilder
  streamingPlaylistFilesQueryBuilder: VideoFileQueryBuilder

  private readonly videoModelBuilder: VideoModelBuilder

  constructor (protected readonly sequelize: Sequelize) {
    super(sequelize, 'list')

    this.videoModelBuilder = new VideoModelBuilder(this.mode, this.tables)
    this.webVideoFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)
    this.streamingPlaylistFilesQueryBuilder = new VideoFileQueryBuilder(sequelize)
  }

  async queryVideos (options: BuildVideosListQueryOptions) {
    this.buildInnerQuery(options)
    this.buildMainQuery(options)

    const rows = await this.runQuery()

    if (options.include & VideoInclude.FILES) {
      const videoIds = Array.from(new Set(rows.map(r => r.id)))

      if (videoIds.length !== 0) {
        const fileQueryOptions = {
          ...pick(options, [ 'transaction', 'logging' ]),

          ids: videoIds,
          includeRedundancy: false
        }

        const [ rowsWebVideoFiles, rowsStreamingPlaylist ] = await Promise.all([
          this.webVideoFilesQueryBuilder.queryWebVideos(fileQueryOptions),
          this.streamingPlaylistFilesQueryBuilder.queryStreamingPlaylistVideos(fileQueryOptions)
        ])

        return this.videoModelBuilder.buildVideosFromRows({ rows, include: options.include, rowsStreamingPlaylist, rowsWebVideoFiles })
      }
    }

    return this.videoModelBuilder.buildVideosFromRows({ rows, include: options.include })
  }

  private buildInnerQuery (options: BuildVideosListQueryOptions) {
    const idsQueryBuilder = new VideosIdListQueryBuilder(this.sequelize)
    const { query, sort, replacements } = idsQueryBuilder.getQuery(options)

    this.replacements = replacements
    this.innerQuery = query
    this.innerSort = sort
  }

  private buildMainQuery (options: BuildVideosListQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    this.addJoin('INNER JOIN "video" ON "tmp"."id" = "video"."id"')

    this.includeChannels()
    this.includeAccounts()
    this.includeThumbnails()

    if (options.user) {
      this.includeUserHistory(options.user.id)
    }

    if (options.videoPlaylistId) {
      this.includePlaylist(options.videoPlaylistId)
    }

    if (options.include & VideoInclude.BLACKLISTED) {
      this.includeBlacklisted()
    }

    if (options.include & VideoInclude.BLOCKED_OWNER) {
      this.includeBlockedOwnerAndServer(options.serverAccountIdForBlock, options.user)
    }

    const select = this.buildSelect()

    this.query = `${select} FROM (${this.innerQuery}) AS "tmp" ${this.joins} ${this.innerSort}`
  }
}
