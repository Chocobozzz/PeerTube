import { ActivityPubActorType, FollowState } from '@peertube/peertube-models'
import { AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { Sequelize } from 'sequelize'
import { InstanceListFollowsQueryBuilder } from './shared/instance-list-follows-query-builder.js'

export interface ListFollowersOptions extends AbstractListQueryOptions {
  actorIds: number[]
  state?: FollowState
  actorType?: ActivityPubActorType
  search?: string
}

export class InstanceListFollowersQueryBuilder extends InstanceListFollowsQueryBuilder<ListFollowersOptions> {
  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListFollowersOptions
  ) {
    super(sequelize, options)
  }

  protected buildSubQueryWhere () {
    this.buildActorFollowingJoin()

    this.subQueryWhere = 'WHERE "ActorFollowing"."id" IN (:actorIds) '
    this.replacements.actorIds = this.options.actorIds

    if (this.options.state) {
      this.subQueryWhere += 'AND "ActorFollowModel"."state" = :state '
      this.replacements.state = this.options.state
    }

    if (this.options.search) {
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      this.subQueryWhere += `AND (` +
        `"ActorFollower->Server"."host" ILIKE ${escapedLikeSearch} ` +
        `OR "ActorFollower"."preferredUsername" ILIKE ${escapedLikeSearch} ` +
        `)`
    }

    if (this.options.actorType) {
      this.subQueryWhere += `AND "ActorFollower"."type" = :actorType `
      this.replacements.actorType = this.options.actorType
    }
  }
}
