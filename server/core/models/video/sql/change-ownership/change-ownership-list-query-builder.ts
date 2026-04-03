import { ChangeOwnershipStateType, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { getActorJoin, getAvatarsJoin, getChannelJoin } from '@server/models/shared/sql/actor-helpers.js'
import { Sequelize } from 'sequelize'
import { VideoChangeOwnershipTableAttributes } from './change-ownership-table-attributes.js'

export interface ListChangeOwnershipOptions extends AbstractListQueryOptions {
  type?: 'video' | 'video-channel'

  id?: number

  accountId?: number

  state?: ChangeOwnershipStateType

  videoId?: number
}

export class ChangeOwnershipListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoChangeOwnershipTableAttributes()

  private builtInitiatorJoin = false
  private builtNextOwnerJoin = false
  private builtVideoJoin = false
  private builtInitiatorAvatarJoin = false
  private builtNextOwnerAvatarJoin = false
  private builtChannelAvatarJoin = false
  private builtChannelAccountAvatarJoin = false
  private builtThumbnailJoin = false
  private builtChannelCollaboratorsJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListChangeOwnershipOptions
  ) {
    super(sequelize, { modelName: 'ChangeOwnershipModel', tableName: 'changeOwnership' }, options)
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    const where: string[] = []

    if (this.options.type === 'video-channel') {
      where.push(`"ChangeOwnershipModel"."videoChannelId" IS NOT NULL`)
    } else if (this.options.type === 'video') {
      where.push(`"ChangeOwnershipModel"."videoId" IS NOT NULL`)
    }

    if (this.options.accountId) {
      this.buildChannelCollaboratorsJoin()

      where.push(
        `"ChangeOwnershipModel"."nextOwnerAccountId" = :nextOwnerAccountId ` +
          `OR (` +
          `"Video->VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId OR ` +
          `"Video->VideoChannel->Account"."id" = :videoAccountId` +
          `)`
      )

      this.replacements.collaborationAccountId = this.options.accountId
      this.replacements.videoAccountId = this.options.accountId
      this.replacements.nextOwnerAccountId = this.options.accountId
    }

    if (this.options.state) {
      where.push(`"ChangeOwnershipModel"."state" = :state`)
      this.replacements.state = this.options.state
    }

    if (this.options.videoId) {
      where.push(`"ChangeOwnershipModel"."videoId" = :videoId`)
      this.replacements.videoId = this.options.videoId
    }

    if (this.options.id) {
      where.push(`"ChangeOwnershipModel"."id" = :id`)
      this.replacements.id = this.options.id
    }

    this.subQueryWhere = where.length !== 0
      ? `WHERE ${where.join(' AND ')}`
      : ''
  }

  // ---------------------------------------------------------------------------

  private buildInitiatorJoin () {
    if (this.builtInitiatorJoin) return

    this.subQueryJoin += ' INNER JOIN "account" "Initiator" ON "Initiator"."id" = "ChangeOwnershipModel"."initiatorAccountId" ' +
      getActorJoin({ base: 'Initiator->', on: '"Initiator"."id"', type: 'account', required: true })

    this.builtInitiatorJoin = true
  }

  private buildNextOwnerJoin () {
    if (this.builtNextOwnerJoin) return

    this.subQueryJoin += ' INNER JOIN "account" "NextOwner" ON "NextOwner"."id" = "ChangeOwnershipModel"."nextOwnerAccountId" ' +
      getActorJoin({ base: 'NextOwner->', on: '"NextOwner"."id"', type: 'account', required: true })

    this.builtNextOwnerJoin = true
  }

  private buildVideoJoin () {
    if (this.builtVideoJoin) return

    this.subQueryJoin += ' INNER JOIN "video" "Video" ON "Video"."id" = "ChangeOwnershipModel"."videoId" ' +
      getChannelJoin({
        base: 'Video->',
        on: '"Video"."channelId"',
        includeAccount: true,
        includeActors: true,
        includeAvatars: false,
        required: true
      })

    this.builtVideoJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

    this.buildVideoJoin()

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "Video->VideoChannel->VideoChannelCollaborators" ' +
      'ON "Video->VideoChannel->VideoChannelCollaborators"."channelId" = "Video->VideoChannel"."id" ' +
      'AND "Video->VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "Video->VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId '

    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED
    this.replacements.collaborationAccountId = this.options.accountId

    this.builtChannelCollaboratorsJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildInitiatorAvatarsJoin () {
    if (this.builtInitiatorAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Initiator->Actor->', on: '"Initiator.Actor.id"' })

    this.builtInitiatorAvatarJoin = true
  }

  private buildNextOwnerAvatarsJoin () {
    if (this.builtNextOwnerAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'NextOwner->Actor->', on: '"NextOwner.Actor.id"' })

    this.builtNextOwnerAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Video->VideoChannel->Actor->', on: '"Video.VideoChannel.Actor.id"' })

    this.builtChannelAvatarJoin = true
  }

  private buildChannelAccountAvatarsJoin () {
    if (this.builtChannelAccountAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Video->VideoChannel->Account->Actor->', on: '"Video.VideoChannel.Account.Actor.id"' })

    this.builtChannelAccountAvatarJoin = true
  }

  private buildThumbnailJoin () {
    if (this.builtThumbnailJoin) return

    this.join += ' LEFT JOIN "thumbnail" "Video->Thumbnails" ON "Video->Thumbnails"."videoId" = "Video.id" '

    this.builtThumbnailJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildInitiatorAvatarsJoin()
    this.buildNextOwnerAvatarsJoin()
    this.buildChannelAvatarsJoin()
    this.buildChannelAccountAvatarsJoin()
    this.buildThumbnailJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getInitiatorAvatarAttributes(),
      this.tableAttributes.getNextOwnerAvatarAttributes(),
      this.tableAttributes.getVideoChannelAvatarAttributes(),
      this.tableAttributes.getVideoChannelAccountAvatarAttributes(),
      this.tableAttributes.getThumbnailAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    this.buildInitiatorJoin()
    this.buildNextOwnerJoin()
    this.buildVideoJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getChangeOwnershipAttributes(),

      this.tableAttributes.getInitiatorAttributes(),
      this.tableAttributes.getInitiatorActorAttributes(),
      this.tableAttributes.getInitiatorServerAttributes(),

      this.tableAttributes.getNextOwnerAttributes(),
      this.tableAttributes.getNextOwnerActorAttributes(),
      this.tableAttributes.getNextOwnerServerAttributes(),

      this.tableAttributes.getVideoAttributes(),

      this.tableAttributes.getVideoChannelAttributes(),
      this.tableAttributes.getVideoChannelActorAttributes(),
      this.tableAttributes.getVideoChannelServerAttributes(),

      this.tableAttributes.getVideoChannelAccountAttributes(),
      this.tableAttributes.getVideoChannelAccountActorAttributes(),
      this.tableAttributes.getVideoChannelAccountServerAttributes()
    ]
  }
}
