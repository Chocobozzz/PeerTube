import { ActorImageType, UserNotificationType_Type } from '@peertube/peertube-models'
import { AbstractRunQuery, ModelBuilder } from '@server/models/shared/index.js'
import { UserNotificationModelForApi } from '@server/types/models/index.js'
import { Sequelize } from 'sequelize'
import { getSort } from '../../shared/index.js'

export interface ListNotificationsOptions {
  userId: number
  unread?: boolean
  typeOneOf?: UserNotificationType_Type[]

  sort: string
  offset: number
  limit: number
}

export class UserNotificationListQueryBuilder extends AbstractRunQuery {
  private innerQuery: string

  constructor (
    protected readonly sequelize: Sequelize,
    private readonly options: ListNotificationsOptions
  ) {
    super(sequelize)
  }

  async listNotifications () {
    this.buildQuery()

    const results = await this.runQuery({ nest: true })
    const modelBuilder = new ModelBuilder<UserNotificationModelForApi>(this.sequelize)

    return modelBuilder.createModels(results, 'UserNotification')
  }

  private buildInnerQuery () {
    this.innerQuery = `SELECT * FROM "userNotification" AS "UserNotificationModel" ` +
      `${this.getWhere()} ` +
      `${this.getOrder()} ` +
      `LIMIT :limit OFFSET :offset `

    this.replacements.limit = this.options.limit
    this.replacements.offset = this.options.offset
  }

  private buildQuery () {
    this.buildInnerQuery()

    this.query = `
      ${this.getSelect()}
      FROM (${this.innerQuery}) "UserNotificationModel"
      ${this.getJoins()}
      ${this.getOrder()}`
  }

  private getWhere () {
    let base = '"UserNotificationModel"."userId" = :userId '
    this.replacements.userId = this.options.userId

    if (this.options.unread === true) {
      base += 'AND "UserNotificationModel"."read" IS FALSE '
    } else if (this.options.unread === false) {
      base += 'AND "UserNotificationModel"."read" IS TRUE '
    }

    if (this.options.typeOneOf) {
      base += 'AND "UserNotificationModel"."type" IN (:typeOneOf) '
      this.replacements.typeOneOf = this.options.typeOneOf
    }

    return `WHERE ${base}`
  }

  private getOrder () {
    const orders = getSort(this.options.sort)

    return 'ORDER BY ' + orders.map(o => `"UserNotificationModel"."${o[0]}" ${o[1]}`).join(', ')
  }

  private getSelect () {
    return `SELECT
      "UserNotificationModel"."id",
      "UserNotificationModel"."type",
      "UserNotificationModel"."read",
      "UserNotificationModel"."createdAt",
      "UserNotificationModel"."updatedAt",

      "Video"."id" AS "Video.id",
      "Video"."uuid" AS "Video.uuid",
      "Video"."name" AS "Video.name",
      "Video"."state" AS "Video.state",
      ${this.buildAccountOrChannelSelect('Video->VideoChannel', 'Video.VideoChannel')},

      "VideoComment"."id" AS "VideoComment.id",
      "VideoComment"."originCommentId" AS "VideoComment.originCommentId",
      "VideoComment"."heldForReview" AS "VideoComment.heldForReview",
      "VideoComment->Video"."id" AS "VideoComment.Video.id",
      "VideoComment->Video"."uuid" AS "VideoComment.Video.uuid",
      "VideoComment->Video"."name" AS "VideoComment.Video.name",
      "VideoComment->Video"."state" AS "VideoComment.Video.state",
      ${this.buildAccountOrChannelSelect('VideoComment->Account', 'VideoComment.Account')}

      "Abuse"."id" AS "Abuse.id",
      "Abuse"."state" AS "Abuse.state",
      "Abuse->VideoAbuse"."id" AS "Abuse.VideoAbuse.id",
      "Abuse->VideoAbuse->Video"."id" AS "Abuse.VideoAbuse.Video.id",
      "Abuse->VideoAbuse->Video"."uuid" AS "Abuse.VideoAbuse.Video.uuid",
      "Abuse->VideoAbuse->Video"."name" AS "Abuse.VideoAbuse.Video.name",
      "Abuse->VideoAbuse->Video"."state" AS "Abuse.VideoAbuse.Video.state",
      "Abuse->VideoCommentAbuse"."id" AS "Abuse.VideoCommentAbuse.id",
      "Abuse->VideoCommentAbuse->VideoComment"."id" AS "Abuse.VideoCommentAbuse.VideoComment.id",
      "Abuse->VideoCommentAbuse->VideoComment"."originCommentId" AS "Abuse.VideoCommentAbuse.VideoComment.originCommentId",
      "Abuse->VideoCommentAbuse->VideoComment->Video"."id" AS "Abuse.VideoCommentAbuse.VideoComment.Video.id",
      "Abuse->VideoCommentAbuse->VideoComment->Video"."name" AS "Abuse.VideoCommentAbuse.VideoComment.Video.name",
      "Abuse->VideoCommentAbuse->VideoComment->Video"."uuid" AS "Abuse.VideoCommentAbuse.VideoComment.Video.uuid",
      "Abuse->VideoCommentAbuse->VideoComment->Video"."state" AS "Abuse.VideoCommentAbuse.VideoComment.Video.state",
      ${this.buildAccountOrChannelSelect('Abuse->FlaggedAccount', 'Abuse.FlaggedAccount')}

      "VideoBlacklist"."id" AS "VideoBlacklist.id",
      "VideoBlacklist->Video"."id" AS "VideoBlacklist.Video.id",
      "VideoBlacklist->Video"."uuid" AS "VideoBlacklist.Video.uuid",
      "VideoBlacklist->Video"."name" AS "VideoBlacklist.Video.name",
      "VideoBlacklist->Video"."state" AS "VideoBlacklist.Video.state",

      "VideoImport"."id" AS "VideoImport.id",
      "VideoImport"."magnetUri" AS "VideoImport.magnetUri",
      "VideoImport"."targetUrl" AS "VideoImport.targetUrl",
      "VideoImport"."torrentName" AS "VideoImport.torrentName",
      "VideoImport->Video"."id" AS "VideoImport.Video.id",
      "VideoImport->Video"."uuid" AS "VideoImport.Video.uuid",
      "VideoImport->Video"."name" AS "VideoImport.Video.name",
      "VideoImport->Video"."state" AS "VideoImport.Video.state",

      "Plugin"."id" AS "Plugin.id",
      "Plugin"."name" AS "Plugin.name",
      "Plugin"."type" AS "Plugin.type",
      "Plugin"."latestVersion" AS "Plugin.latestVersion",

      "Application"."id" AS "Application.id",
      "Application"."latestPeerTubeVersion" AS "Application.latestPeerTubeVersion",

      "ActorFollow"."id" AS "ActorFollow.id",
      "ActorFollow"."state" AS "ActorFollow.state",
      "ActorFollow->ActorFollower"."id" AS "ActorFollow.ActorFollower.id",
      "ActorFollow->ActorFollower"."preferredUsername" AS "ActorFollow.ActorFollower.preferredUsername",
      "ActorFollow->ActorFollower->Account"."id" AS "ActorFollow.ActorFollower.Account.id",
      "ActorFollow->ActorFollower->Account"."name" AS "ActorFollow.ActorFollower.Account.name",
      "ActorFollow->ActorFollower->Avatars"."id" AS "ActorFollow.ActorFollower.Avatars.id",
      "ActorFollow->ActorFollower->Avatars"."width" AS "ActorFollow.ActorFollower.Avatars.width",
      "ActorFollow->ActorFollower->Avatars"."type" AS "ActorFollow.ActorFollower.Avatars.type",
      "ActorFollow->ActorFollower->Avatars"."filename" AS "ActorFollow.ActorFollower.Avatars.filename",
      "ActorFollow->ActorFollower->Server"."id" AS "ActorFollow.ActorFollower.Server.id",
      "ActorFollow->ActorFollower->Server"."host" AS "ActorFollow.ActorFollower.Server.host",
      "ActorFollow->ActorFollowing"."id" AS "ActorFollow.ActorFollowing.id",
      "ActorFollow->ActorFollowing"."preferredUsername" AS "ActorFollow.ActorFollowing.preferredUsername",
      "ActorFollow->ActorFollowing"."type" AS "ActorFollow.ActorFollowing.type",
      "ActorFollow->ActorFollowing->VideoChannel"."id" AS "ActorFollow.ActorFollowing.VideoChannel.id",
      "ActorFollow->ActorFollowing->VideoChannel"."name" AS "ActorFollow.ActorFollowing.VideoChannel.name",
      "ActorFollow->ActorFollowing->Account"."id" AS "ActorFollow.ActorFollowing.Account.id",
      "ActorFollow->ActorFollowing->Account"."name" AS "ActorFollow.ActorFollowing.Account.name",
      "ActorFollow->ActorFollowing->Server"."id" AS "ActorFollow.ActorFollowing.Server.id",
      "ActorFollow->ActorFollowing->Server"."host" AS "ActorFollow.ActorFollowing.Server.host",

      ${this.buildAccountOrChannelSelect('Account', 'Account')},

      "UserRegistration"."id" AS "UserRegistration.id",
      "UserRegistration"."username" AS "UserRegistration.username",

      "VideoCaption"."id" AS "VideoCaption.id",
      "VideoCaption"."language" AS "VideoCaption.language",
      "VideoCaption->Video"."id" AS "VideoCaption.Video.id",
      "VideoCaption->Video"."uuid" AS "VideoCaption.Video.uuid",
      "VideoCaption->Video"."name" AS "VideoCaption.Video.name",
      "VideoCaption->Video"."state" AS "VideoCaption.Video.state",

      "VideoChannelCollaborator"."id" AS "VideoChannelCollaborator.id",
      "VideoChannelCollaborator"."state" AS "VideoChannelCollaborator.state",
      ${this.buildAccountOrChannelSelect('VideoChannelCollaborator->Account', 'VideoChannelCollaborator.Account')},
      ${this.buildAccountOrChannelSelect('VideoChannelCollaborator->VideoChannel', 'VideoChannelCollaborator.VideoChannel')}`
  }

  private getJoins () {
    return `
    LEFT JOIN (
      "video" AS "Video"
      ${this.buildChannelJoin('Video', 'channelId')}
    ) ON "UserNotificationModel"."videoId" = "Video"."id"

    LEFT JOIN (
      "videoComment" AS "VideoComment"
      ${this.buildAccountJoin('VideoComment', 'accountId')}
      INNER JOIN "video" AS "VideoComment->Video" ON "VideoComment"."videoId" = "VideoComment->Video"."id"
    ) ON "UserNotificationModel"."commentId" = "VideoComment"."id"

    LEFT JOIN "abuse" AS "Abuse" ON "UserNotificationModel"."abuseId" = "Abuse"."id"
    LEFT JOIN "videoAbuse" AS "Abuse->VideoAbuse" ON "Abuse"."id" = "Abuse->VideoAbuse"."abuseId"
    LEFT JOIN "video" AS "Abuse->VideoAbuse->Video" ON "Abuse->VideoAbuse"."videoId" = "Abuse->VideoAbuse->Video"."id"
    LEFT JOIN "commentAbuse" AS "Abuse->VideoCommentAbuse" ON "Abuse"."id" = "Abuse->VideoCommentAbuse"."abuseId"
    LEFT JOIN "videoComment" AS "Abuse->VideoCommentAbuse->VideoComment"
      ON "Abuse->VideoCommentAbuse"."videoCommentId" = "Abuse->VideoCommentAbuse->VideoComment"."id"
    LEFT JOIN "video" AS "Abuse->VideoCommentAbuse->VideoComment->Video"
      ON "Abuse->VideoCommentAbuse->VideoComment"."videoId" = "Abuse->VideoCommentAbuse->VideoComment->Video"."id"
    LEFT JOIN (
      "account" AS "Abuse->FlaggedAccount"
      ${this.buildActorJoin('Abuse->FlaggedAccount')}
    ) ON "Abuse"."flaggedAccountId" = "Abuse->FlaggedAccount"."id"

    LEFT JOIN (
      "videoBlacklist" AS "VideoBlacklist"
      INNER JOIN "video" AS "VideoBlacklist->Video" ON "VideoBlacklist"."videoId" = "VideoBlacklist->Video"."id"
    ) ON "UserNotificationModel"."videoBlacklistId" = "VideoBlacklist"."id"

    LEFT JOIN "videoImport" AS "VideoImport" ON "UserNotificationModel"."videoImportId" = "VideoImport"."id"
    LEFT JOIN "video" AS "VideoImport->Video" ON "VideoImport"."videoId" = "VideoImport->Video"."id"

    LEFT JOIN "plugin" AS "Plugin" ON "UserNotificationModel"."pluginId" = "Plugin"."id"

    LEFT JOIN "application" AS "Application" ON "UserNotificationModel"."applicationId" = "Application"."id"

    LEFT JOIN (
      "actorFollow" AS "ActorFollow"
      INNER JOIN "actor" AS "ActorFollow->ActorFollower" ON "ActorFollow"."actorId" = "ActorFollow->ActorFollower"."id"
      INNER JOIN "account" AS "ActorFollow->ActorFollower->Account"
        ON "ActorFollow->ActorFollower"."id" = "ActorFollow->ActorFollower->Account"."actorId"
      ${this.buildActorImageJoin('ActorFollow->ActorFollower')}
      ${this.buildActorServerJoin('ActorFollow->ActorFollower')}

      INNER JOIN "actor" AS "ActorFollow->ActorFollowing" ON "ActorFollow"."targetActorId" = "ActorFollow->ActorFollowing"."id"
      LEFT JOIN "videoChannel" AS "ActorFollow->ActorFollowing->VideoChannel"
        ON "ActorFollow->ActorFollowing"."id" = "ActorFollow->ActorFollowing->VideoChannel"."actorId"
      LEFT JOIN "account" AS "ActorFollow->ActorFollowing->Account"
        ON "ActorFollow->ActorFollowing"."id" = "ActorFollow->ActorFollowing->Account"."actorId"
      ${this.buildActorServerJoin('ActorFollow->ActorFollowing')}
    ) ON "UserNotificationModel"."actorFollowId" = "ActorFollow"."id"

    LEFT JOIN (
      "account" AS "Account"
      ${this.buildActorJoin('Account')}
    ) ON "UserNotificationModel"."accountId" = "Account"."id"

    LEFT JOIN "userRegistration" as "UserRegistration" ON "UserNotificationModel"."userRegistrationId" = "UserRegistration"."id"

    LEFT JOIN (
      "videoCaption" AS "VideoCaption"
      INNER JOIN "video" AS "VideoCaption->Video" ON "VideoCaption"."videoId" = "VideoCaption->Video"."id"
    ) ON "UserNotificationModel"."videoCaptionId" = "VideoCaption"."id"

    LEFT JOIN (
      "videoChannelCollaborator" AS "VideoChannelCollaborator"
      ${this.buildAccountJoin('VideoChannelCollaborator', 'accountId')}
      ${this.buildChannelJoin('VideoChannelCollaborator', 'channelId')}
    ) ON "UserNotificationModel"."channelCollaboratorId" = "VideoChannelCollaborator"."id"
    `
  }

  private buildAccountOrChannelSelect (tableName: string, alias: string) {
    return `
      "${tableName}"."id" AS "${alias}.id",
      "${tableName}"."name" AS "${alias}.name",
      "${tableName}->Actor"."id" AS "${alias}.Actor.id",
      "${tableName}->Actor"."preferredUsername" AS "${alias}.Actor.preferredUsername",
      "${tableName}->Actor->Avatars"."id" AS "${alias}.Actor.Avatars.id",
      "${tableName}->Actor->Avatars"."width" AS "${alias}.Actor.Avatars.width",
      "${tableName}->Actor->Avatars"."type" AS "${alias}.Actor.Avatars.type",
      "${tableName}->Actor->Avatars"."filename" AS "${alias}.Actor.Avatars.filename",
      "${tableName}->Actor->Server"."id" AS "${alias}.Actor.Server.id",
      "${tableName}->Actor->Server"."host" AS "${alias}.Actor.Server.host"
    `
  }

  private buildAccountJoin (tableName: string, columnJoin: string) {
    return `INNER JOIN "account" AS "${tableName}->Account" ON "${tableName}"."${columnJoin}" = "${tableName}->Account"."id"` +
      this.buildActorJoin(`${tableName}->Account`)
  }

  private buildChannelJoin (tableName: string, columnJoin: string) {
    // eslint-disable-next-line max-len
    return `INNER JOIN "videoChannel" AS "${tableName}->VideoChannel" ON "${tableName}"."${columnJoin}" = "${tableName}->VideoChannel"."id"` +
      this.buildActorJoin(`${tableName}->VideoChannel`)
  }

  private buildActorJoin (tableName: string) {
    return `INNER JOIN "actor" AS "${tableName}->Actor" ON "${tableName}"."actorId" = "${tableName}->Actor"."id"` +
      this.buildActorImageJoin(`${tableName}->Actor`) +
      this.buildActorServerJoin(`${tableName}->Actor`)
  }

  private buildActorImageJoin (tableName: string) {
    return `LEFT JOIN "actorImage" AS "${tableName}->Avatars"
        ON "${tableName}"."id" = "${tableName}->Avatars"."actorId"
        AND "${tableName}->Avatars"."type" = ${ActorImageType.AVATAR}`
  }

  private buildActorServerJoin (tableName: string) {
    return `LEFT JOIN "server" AS "${tableName}->Server"
        ON "${tableName}"."serverId" = "${tableName}->Server"."id"`
  }
}
