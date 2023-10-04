import { Sequelize } from 'sequelize'
import { ModelBuilder } from '@server/models/shared/index.js'
import { MActorFollowActorsDefault } from '@server/types/models/index.js'
import { ActivityPubActorType, FollowState } from '@peertube/peertube-models'
import { parseRowCountResult } from '../../shared/index.js'
import { InstanceListFollowsQueryBuilder } from './shared/instance-list-follows-query-builder.js'

export interface ListFollowersOptions {
  actorIds: number[]
  start: number
  count: number
  sort: string
  state?: FollowState
  actorType?: ActivityPubActorType
  search?: string
}

export class InstanceListFollowersQueryBuilder extends InstanceListFollowsQueryBuilder <ListFollowersOptions> {

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListFollowersOptions
  ) {
    super(sequelize, options)
  }

  async listFollowers () {
    this.buildListQuery()

    const results = await this.runQuery({ nest: true })
    const modelBuilder = new ModelBuilder<MActorFollowActorsDefault>(this.sequelize)

    return modelBuilder.createModels(results, 'ActorFollow')
  }

  async countFollowers () {
    this.buildCountQuery()

    const result = await this.runQuery()

    return parseRowCountResult(result)
  }

  protected getWhere () {
    let where = 'WHERE "ActorFollowing"."id" IN (:actorIds) '
    this.replacements.actorIds = this.options.actorIds

    if (this.options.state) {
      where += 'AND "ActorFollowModel"."state" = :state '
      this.replacements.state = this.options.state
    }

    if (this.options.search) {
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      where += `AND (` +
        `"ActorFollower->Server"."host" ILIKE ${escapedLikeSearch} ` +
        `OR "ActorFollower"."preferredUsername" ILIKE ${escapedLikeSearch} ` +
      `)`
    }

    if (this.options.actorType) {
      where += `AND "ActorFollower"."type" = :actorType `
      this.replacements.actorType = this.options.actorType
    }

    return where
  }
}
