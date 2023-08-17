import { Sequelize } from 'sequelize'
import { AbstractRunQuery } from '@server/models/shared/index.js'
import { ActorImageType } from '@peertube/peertube-models'
import { getInstanceFollowsSort } from '../../../shared/index.js'
import { ActorFollowTableAttributes } from './actor-follow-table-attributes.js'

type BaseOptions = {
  sort: string
  count: number
  start: number
}

export abstract class InstanceListFollowsQueryBuilder <T extends BaseOptions> extends AbstractRunQuery {
  protected readonly tableAttributes = new ActorFollowTableAttributes()

  protected innerQuery: string

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: T
  ) {
    super(sequelize)
  }

  protected abstract getWhere (): string

  protected getJoins () {
    return 'INNER JOIN "actor" "ActorFollower" ON "ActorFollower"."id" = "ActorFollowModel"."actorId" ' +
      'INNER JOIN "actor" "ActorFollowing" ON "ActorFollowing"."id" = "ActorFollowModel"."targetActorId" '
  }

  protected getServerJoin (actorName: string) {
    return `LEFT JOIN "server" "${actorName}->Server" ON "${actorName}"."serverId" = "${actorName}->Server"."id" `
  }

  protected getAvatarsJoin (actorName: string) {
    return `LEFT JOIN "actorImage" "${actorName}->Avatars" ON "${actorName}.id" = "${actorName}->Avatars"."actorId" ` +
      `AND "${actorName}->Avatars"."type" = ${ActorImageType.AVATAR}`
  }

  private buildInnerQuery () {
    this.innerQuery = `${this.getInnerSelect()} ` +
      `FROM "actorFollow" AS "ActorFollowModel" ` +
      `${this.getJoins()} ` +
      `${this.getServerJoin('ActorFollowing')} ` +
      `${this.getServerJoin('ActorFollower')} ` +
      `${this.getWhere()} ` +
      `${this.getOrder()} ` +
      `LIMIT :limit OFFSET :offset `

    this.replacements.limit = this.options.count
    this.replacements.offset = this.options.start
  }

  protected buildListQuery () {
    this.buildInnerQuery()

    this.query = `${this.getSelect()} ` +
      `FROM (${this.innerQuery}) AS "ActorFollowModel" ` +
      `${this.getAvatarsJoin('ActorFollower')} ` +
      `${this.getAvatarsJoin('ActorFollowing')} ` +
      `${this.getOrder()}`
  }

  protected buildCountQuery () {
    this.query = `SELECT COUNT(*) AS "total" ` +
      `FROM "actorFollow" AS "ActorFollowModel" ` +
      `${this.getJoins()} ` +
      `${this.getServerJoin('ActorFollowing')} ` +
      `${this.getServerJoin('ActorFollower')} ` +
      `${this.getWhere()}`
  }

  private getInnerSelect () {
    return this.buildSelect([
      this.tableAttributes.getFollowAttributes(),
      this.tableAttributes.getActorAttributes('ActorFollower'),
      this.tableAttributes.getActorAttributes('ActorFollowing'),
      this.tableAttributes.getServerAttributes('ActorFollower'),
      this.tableAttributes.getServerAttributes('ActorFollowing')
    ])
  }

  private getSelect () {
    return this.buildSelect([
      '"ActorFollowModel".*',
      this.tableAttributes.getAvatarAttributes('ActorFollower'),
      this.tableAttributes.getAvatarAttributes('ActorFollowing')
    ])
  }

  private getOrder () {
    const orders = getInstanceFollowsSort(this.options.sort)

    return 'ORDER BY ' + orders.map(o => `"${o[0]}" ${o[1]}`).join(', ')
  }
}
