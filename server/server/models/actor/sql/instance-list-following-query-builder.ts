import { Sequelize } from 'sequelize'
import { ModelBuilder } from '@server/models/shared/index.js'
import { MActorFollowActorsDefault } from '@server/types/models/index.js'
import { ActivityPubActorType, FollowState } from '@peertube/peertube-models'
import { parseRowCountResult } from '../../shared/index.js'
import { InstanceListFollowsQueryBuilder } from './shared/instance-list-follows-query-builder.js'

export interface ListFollowingOptions {
  followerId: number
  start: number
  count: number
  sort: string
  state?: FollowState
  actorType?: ActivityPubActorType
  search?: string
}

export class InstanceListFollowingQueryBuilder extends InstanceListFollowsQueryBuilder <ListFollowingOptions> {

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListFollowingOptions
  ) {
    super(sequelize, options)
  }

  async listFollowing () {
    this.buildListQuery()

    const results = await this.runQuery({ nest: true })
    const modelBuilder = new ModelBuilder<MActorFollowActorsDefault>(this.sequelize)

    return modelBuilder.createModels(results, 'ActorFollow')
  }

  async countFollowing () {
    this.buildCountQuery()

    const result = await this.runQuery()

    return parseRowCountResult(result)
  }

  protected getWhere () {
    let where = 'WHERE "ActorFollowModel"."actorId" = :followerId '
    this.replacements.followerId = this.options.followerId

    if (this.options.state) {
      where += 'AND "ActorFollowModel"."state" = :state '
      this.replacements.state = this.options.state
    }

    if (this.options.search) {
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      where += `AND (` +
        `"ActorFollowing->Server"."host" ILIKE ${escapedLikeSearch} ` +
        `OR "ActorFollowing"."preferredUsername" ILIKE ${escapedLikeSearch} ` +
      `)`
    }

    if (this.options.actorType) {
      where += `AND "ActorFollowing"."type" = :actorType `
      this.replacements.actorType = this.options.actorType
    }

    return where
  }
}
