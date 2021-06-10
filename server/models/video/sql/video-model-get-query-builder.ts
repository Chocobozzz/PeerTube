import { Sequelize, Transaction } from 'sequelize'
import validator from 'validator'
import { AbstractVideosModelQueryBuilder } from './shared/abstract-videos-model-query-builder'

export type BuildVideoGetQueryOptions = {
  id: number | string
  transaction?: Transaction
  userId?: number
  forGetAPI?: boolean
}

export class VideosModelGetQueryBuilder extends AbstractVideosModelQueryBuilder {
  protected attributes: { [key: string]: string }
  protected joins: string[] = []
  protected where: string

  constructor (protected readonly sequelize: Sequelize) {
    super('get')
  }

  queryVideos (options: BuildVideoGetQueryOptions) {
    this.buildGetQuery(options)

    return this.runQuery(options.transaction, true).then(rows => {
      const videos = this.videoModelBuilder.buildVideosFromRows(rows)

      if (videos.length > 1) {
        throw new Error('Video results is more than ')
      }

      if (videos.length === 0) return null
      return videos[0]
    })
  }

  private buildGetQuery (options: BuildVideoGetQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    this.includeChannels()
    this.includeAccounts()

    this.includeTags()

    this.includeThumbnails()

    this.includeFiles()

    this.includeBlacklisted()

    this.includeScheduleUpdate()

    this.includeLive()

    if (options.userId) {
      this.includeUserHistory(options.userId)
    }

    if (options.forGetAPI === true) {
      this.includeTrackers()
      this.includeRedundancies()
    }

    this.whereId(options.id)

    const select = this.buildSelect()
    const order = this.buildOrder()

    this.query = `${select} FROM "video" ${this.joins.join(' ')} ${this.where} ${order}`
  }

  private whereId (id: string | number) {
    if (validator.isInt('' + id)) {
      this.where = 'WHERE "video".id = :videoId'
    } else {
      this.where = 'WHERE uuid = :videoId'
    }

    this.replacements.videoId = id
  }

  private buildOrder () {
    return 'ORDER BY "Tags"."name" ASC'
  }
}
