import { Sequelize } from 'sequelize'
import { AbstractVideosModelQueryBuilder } from './shared/abstract-videos-model-query-builder'
import { BuildVideosListQueryOptions, VideosIdListQueryBuilder } from './videos-id-list-query-builder'

export class VideosModelListQueryBuilder extends AbstractVideosModelQueryBuilder {
  protected attributes: { [key: string]: string }
  protected joins: string[] = []

  private innerQuery: string
  private innerSort: string

  constructor (protected readonly sequelize: Sequelize) {
    super('list')
  }

  queryVideos (options: BuildVideosListQueryOptions) {
    this.buildInnerQuery(options)
    this.buildListQueryFromIdsQuery(options)

    return this.runQuery(undefined, true).then(rows => this.videoModelBuilder.buildVideosFromRows(rows))
  }

  private buildInnerQuery (options: BuildVideosListQueryOptions) {
    const idsQueryBuilder = new VideosIdListQueryBuilder(this.sequelize)
    const { query, sort, replacements } = idsQueryBuilder.getIdsListQueryAndSort(options)

    this.replacements = replacements
    this.innerQuery = query
    this.innerSort = sort
  }

  private buildListQueryFromIdsQuery (options: BuildVideosListQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    this.joins = [ 'INNER JOIN "video" ON "tmp"."id" = "video"."id"' ]

    this.includeChannels()
    this.includeAccounts()
    this.includeThumbnails()

    if (options.withFiles) {
      this.includeFiles()
    }

    if (options.user) {
      this.includeUserHistory(options.user.id)
    }

    if (options.videoPlaylistId) {
      this.includePlaylist(options.videoPlaylistId)
    }

    const select = this.buildSelect()

    this.query = `${select} FROM (${this.innerQuery}) AS "tmp" ${this.joins.join(' ')} ${this.innerSort}`
  }
}
