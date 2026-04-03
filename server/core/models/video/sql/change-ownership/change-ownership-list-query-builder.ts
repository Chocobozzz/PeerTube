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
  videoChannelId?: number
}

export class ChangeOwnershipListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoChangeOwnershipTableAttributes()

  private builtInitiatorJoin = false
  private builtNextOwnerJoin = false
  private builtInitiatorAvatarJoin = false
  private builtNextOwnerAvatarJoin = false

  private builtVideoJoin = false
  private builtVideoChannelAvatarJoin = false
  private builtThumbnailJoin = false

  private builtChannelJoin = false
  private builtChannelCollaboratorsJoin = false
  private builtChannelAvatarJoin = false

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
      this.buildVideoJoin()
      this.buildChannelJoin()

      this.buildChannelCollaboratorsJoin()

      where.push(
        `(` +
          `"ChangeOwnershipModel"."nextOwnerAccountId" = :nextOwnerAccountId ` +
          `OR (` +
          `  "Video->VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId OR ` +
          `  "Video->VideoChannel"."accountId" = :videoAccountId` +
          `)` +
          `OR "VideoChannel"."accountId" = :videoChannelAccountId` +
          `)`
      )

      this.replacements.collaborationAccountId = this.options.accountId
      this.replacements.videoAccountId = this.options.accountId
      this.replacements.nextOwnerAccountId = this.options.accountId
      this.replacements.videoChannelAccountId = this.options.accountId
    }

    if (this.options.state) {
      where.push(`"ChangeOwnershipModel"."state" = :state`)
      this.replacements.state = this.options.state
    }

    if (this.options.videoId) {
      where.push(`"ChangeOwnershipModel"."videoId" = :videoId`)
      this.replacements.videoId = this.options.videoId
    }

    if (this.options.videoChannelId) {
      where.push(`"ChangeOwnershipModel"."videoChannelId" = :videoChannelId`)
      this.replacements.videoChannelId = this.options.videoChannelId
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

    this.subQueryJoin += ' LEFT JOIN "video" "Video" ON "Video"."id" = "ChangeOwnershipModel"."videoId" ' +
      getChannelJoin({
        base: 'Video->',
        on: '"Video"."channelId"',
        includeAccount: false,
        includeActors: true,
        includeAvatars: false,
        required: false
      })

    this.builtVideoJoin = true
  }

  private buildChannelJoin () {
    if (this.builtChannelJoin) return

    this.subQueryJoin += getChannelJoin({
      base: '',
      on: '"ChangeOwnershipModel"."videoChannelId"',
      includeAccount: false,
      includeActors: true,
      includeAvatars: false,
      required: false
    })

    this.builtChannelJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

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

  private buildVideoChannelAvatarsJoin () {
    if (this.builtVideoChannelAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Video->VideoChannel->Actor->', on: '"Video.VideoChannel.Actor.id"' })

    this.builtVideoChannelAvatarJoin = true
  }

  private buildThumbnailJoin () {
    if (this.builtThumbnailJoin) return

    this.join += ' LEFT JOIN "thumbnail" "Video->Thumbnails" ON "Video->Thumbnails"."videoId" = "Video.id" '

    this.builtThumbnailJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'VideoChannel->Actor->', on: '"VideoChannel.Actor.id"' })

    this.builtChannelAvatarJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildInitiatorAvatarsJoin()
    this.buildNextOwnerAvatarsJoin()
    this.buildVideoChannelAvatarsJoin()
    this.buildChannelAvatarsJoin()
    this.buildThumbnailJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getInitiatorAvatarAttributes(),
      this.tableAttributes.getNextOwnerAvatarAttributes(),
      this.tableAttributes.getVideoChannelAvatarAttributes(),
      this.tableAttributes.getThumbnailAttributes(),
      this.tableAttributes.getChannelAvatarAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    this.buildInitiatorJoin()
    this.buildNextOwnerJoin()
    this.buildVideoJoin()
    this.buildChannelJoin()
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

      this.tableAttributes.getChannelAttributes(),
      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes()
    ]
  }
}
