import { ActorImageType } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { Sequelize } from 'sequelize'
import { getInstanceFollowsSort } from '../../../shared/index.js'
import { ActorFollowTableAttributes } from './actor-follow-table-attributes.js'

export abstract class InstanceListFollowsQueryBuilder<T extends AbstractListQueryOptions> extends AbstractListQuery {
  protected readonly tableAttributes = new ActorFollowTableAttributes()

  private builtActorFollowingJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: T
  ) {
    super(sequelize, { modelName: 'ActorFollowModel', tableName: 'actorFollow' }, options)
  }

  protected buildQueryJoin () {
    this.join += this.getAvatarsJoin('ActorFollower')
    this.join += this.getAvatarsJoin('ActorFollowing')
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getAvatarAttributes('ActorFollower'),
      this.tableAttributes.getAvatarAttributes('ActorFollowing')
    ]
  }

  protected buildSubQueryJoin () {
    this.buildActorFollowingJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getFollowAttributes(),
      this.tableAttributes.getActorAttributes('ActorFollower'),
      this.tableAttributes.getActorAttributes('ActorFollowing'),
      this.tableAttributes.getServerAttributes('ActorFollower'),
      this.tableAttributes.getServerAttributes('ActorFollowing')
    ]
  }

  protected getSort (sort: string) {
    return getInstanceFollowsSort(sort)
  }

  protected buildActorFollowingJoin () {
    if (this.builtActorFollowingJoin) return

    this.subQueryJoin += 'INNER JOIN "actor" "ActorFollower" ON "ActorFollower"."id" = "ActorFollowModel"."actorId" ' +
      'INNER JOIN "actor" "ActorFollowing" ON "ActorFollowing"."id" = "ActorFollowModel"."targetActorId" '

    this.subQueryJoin += this.getServerJoin('ActorFollowing')
    this.subQueryJoin += this.getServerJoin('ActorFollower')

    this.builtActorFollowingJoin = true
  }

  // ---------------------------------------------------------------------------

  private getServerJoin (actorName: string) {
    return `LEFT JOIN "server" "${actorName}->Server" ON "${actorName}"."serverId" = "${actorName}->Server"."id" `
  }

  private getAvatarsJoin (actorName: string) {
    return `LEFT JOIN "actorImage" "${actorName}->Avatars" ON "${actorName}.id" = "${actorName}->Avatars"."actorId" ` +
      `AND "${actorName}->Avatars"."type" = ${ActorImageType.AVATAR} `
  }
}
