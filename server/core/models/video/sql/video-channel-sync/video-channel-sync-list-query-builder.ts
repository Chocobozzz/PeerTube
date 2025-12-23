import { VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { getChannelSyncSort } from '@server/models/shared/index.js'
import { OrderItem, Sequelize } from 'sequelize'
import { VideoChannelSyncTableAttributes } from './video-channel-sync-table-attributes.js'
import { getAvatarsJoin, getChannelJoin } from '@server/models/shared/sql/actor-helpers.js'

export interface ListVideoChannelSyncsOptions extends AbstractListQueryOptions {
  accountId: number

  includeCollaborations?: boolean
}

export class VideoChannelSyncListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoChannelSyncTableAttributes()

  private builtChannelJoin = false
  private builtChannelAvatarsJoin = false
  private builtChannelCollaboratorsJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListVideoChannelSyncsOptions
  ) {
    super(sequelize, { modelName: 'VideoChannelSyncModel', tableName: 'videoChannelSync' }, options)
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    const where: string[] = []

    this.buildChannelJoin()

    if (this.options.includeCollaborations) {
      this.buildChannelCollaboratorsJoin()

      where.push(
        `("VideoChannel"."accountId" = :accountId OR "VideoChannel->VideoChannelCollaborators"."accountId" = :accountId)`
      )

      this.replacements.accountId = this.options.accountId
    } else {
      where.push(`"VideoChannel"."accountId" = :accountId`)

      this.replacements.accountId = this.options.accountId
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  // ---------------------------------------------------------------------------

  private buildChannelJoin () {
    if (this.builtChannelJoin) return

    this.subQueryJoin += getChannelJoin({
      on: `"VideoChannelSyncModel"."videoChannelId"`,
      includeAccount: false,
      includeAvatars: false,
      includeActors: true,
      required: true
    })
    this.builtChannelJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "VideoChannel->VideoChannelCollaborators" ' +
      'ON "VideoChannel->VideoChannelCollaborators"."channelId" = "VideoChannel"."id" ' +
      'AND "VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "VideoChannel->VideoChannelCollaborators"."accountId" = :accountId '

    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED
    this.replacements.accountId = this.options.accountId

    this.builtChannelCollaboratorsJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarsJoin) return

    this.join += getAvatarsJoin({ base: 'VideoChannel->Actor->', on: `"VideoChannelSyncModel"."VideoChannel.Actor.id"` })

    this.builtChannelAvatarsJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildChannelAvatarsJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getChannelAvatarAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    this.buildChannelJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getVideoChannelSyncAttributes(),

      this.tableAttributes.getChannelAttributes(),
      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes()
    ]
  }

  protected getSort (sort: string): OrderItem[] {
    return getChannelSyncSort(sort)
  }
}
