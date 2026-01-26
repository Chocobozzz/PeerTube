import { ActivityPubActorType, FollowState } from '@peertube/peertube-models'
import { AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { Sequelize } from 'sequelize'
import { InstanceListFollowsQueryBuilder } from './shared/instance-list-follows-query-builder.js'

export interface ListFollowingOptions extends AbstractListQueryOptions {
  followerId: number
  state?: FollowState
  actorType?: ActivityPubActorType
  search?: string
}

export class InstanceListFollowingQueryBuilder extends InstanceListFollowsQueryBuilder<ListFollowingOptions> {
  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListFollowingOptions
  ) {
    super(sequelize, options)
  }

  protected buildSubQueryWhere () {
    this.buildActorFollowingJoin()

    this.subQueryWhere = 'WHERE "ActorFollowModel"."actorId" = :followerId '
    this.replacements.followerId = this.options.followerId

    if (this.options.state) {
      this.subQueryWhere += 'AND "ActorFollowModel"."state" = :state '
      this.replacements.state = this.options.state
    }

    if (this.options.search) {
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      this.subQueryWhere += `AND (` +
        `"ActorFollowing->Server"."host" ILIKE ${escapedLikeSearch} ` +
        `OR "ActorFollowing"."preferredUsername" ILIKE ${escapedLikeSearch} ` +
        `)`
    }

    if (this.options.actorType) {
      this.subQueryWhere += `AND "ActorFollowing"."type" = :actorType `
      this.replacements.actorType = this.options.actorType
    }
  }
}
