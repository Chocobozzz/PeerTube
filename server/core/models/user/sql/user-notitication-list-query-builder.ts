import { Sequelize } from 'sequelize'
import { AbstractRunQuery, ModelBuilder } from '@server/models/shared/index.js'
import { UserNotificationModelForApi } from '@server/types/models/index.js'
import { ActorImageType } from '@peertube/peertube-models'
import { getSort } from '../../shared/index.js'

export interface ListNotificationsOptions {
  userId: number
  unread?: boolean
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
      "Video->VideoChannel"."id" AS "Video.VideoChannel.id",
      "Video->VideoChannel"."name" AS "Video.VideoChannel.name",
      "Video->VideoChannel->Actor"."id" AS "Video.VideoChannel.Actor.id",
      "Video->VideoChannel->Actor"."preferredUsername" AS "Video.VideoChannel.Actor.preferredUsername",
      "Video->VideoChannel->Actor->Avatars"."id" AS "Video.VideoChannel.Actor.Avatars.id",
      "Video->VideoChannel->Actor->Avatars"."width" AS "Video.VideoChannel.Actor.Avatars.width",
      "Video->VideoChannel->Actor->Avatars"."type" AS "Video.VideoChannel.Actor.Avatars.type",
      "Video->VideoChannel->Actor->Avatars"."filename" AS "Video.VideoChannel.Actor.Avatars.filename",
      "Video->VideoChannel->Actor->Server"."id" AS "Video.VideoChannel.Actor.Server.id",
      "Video->VideoChannel->Actor->Server"."host" AS "Video.VideoChannel.Actor.Server.host",
      "VideoComment"."id" AS "VideoComment.id",
      "VideoComment"."originCommentId" AS "VideoComment.originCommentId",
      "VideoComment"."heldForReview" AS "VideoComment.heldForReview",
      "VideoComment->Account"."id" AS "VideoComment.Account.id",
      "VideoComment->Account"."name" AS "VideoComment.Account.name",
      "VideoComment->Account->Actor"."id" AS "VideoComment.Account.Actor.id",
      "VideoComment->Account->Actor"."preferredUsername" AS "VideoComment.Account.Actor.preferredUsername",
      "VideoComment->Account->Actor->Avatars"."id" AS "VideoComment.Account.Actor.Avatars.id",
      "VideoComment->Account->Actor->Avatars"."width" AS "VideoComment.Account.Actor.Avatars.width",
      "VideoComment->Account->Actor->Avatars"."type" AS "VideoComment.Account.Actor.Avatars.type",
      "VideoComment->Account->Actor->Avatars"."filename" AS "VideoComment.Account.Actor.Avatars.filename",
      "VideoComment->Account->Actor->Server"."id" AS "VideoComment.Account.Actor.Server.id",
      "VideoComment->Account->Actor->Server"."host" AS "VideoComment.Account.Actor.Server.host",
      "VideoComment->Video"."id" AS "VideoComment.Video.id",
      "VideoComment->Video"."uuid" AS "VideoComment.Video.uuid",
      "VideoComment->Video"."name" AS "VideoComment.Video.name",
      "VideoComment->Video"."state" AS "VideoComment.Video.state",
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
      "Abuse->FlaggedAccount"."id" AS "Abuse.FlaggedAccount.id",
      "Abuse->FlaggedAccount"."name" AS "Abuse.FlaggedAccount.name",
      "Abuse->FlaggedAccount"."description" AS "Abuse.FlaggedAccount.description",
      "Abuse->FlaggedAccount"."actorId" AS "Abuse.FlaggedAccount.actorId",
      "Abuse->FlaggedAccount"."userId" AS "Abuse.FlaggedAccount.userId",
      "Abuse->FlaggedAccount"."applicationId" AS "Abuse.FlaggedAccount.applicationId",
      "Abuse->FlaggedAccount"."createdAt" AS "Abuse.FlaggedAccount.createdAt",
      "Abuse->FlaggedAccount"."updatedAt" AS "Abuse.FlaggedAccount.updatedAt",
      "Abuse->FlaggedAccount->Actor"."id" AS "Abuse.FlaggedAccount.Actor.id",
      "Abuse->FlaggedAccount->Actor"."preferredUsername" AS "Abuse.FlaggedAccount.Actor.preferredUsername",
      "Abuse->FlaggedAccount->Actor->Avatars"."id" AS "Abuse.FlaggedAccount.Actor.Avatars.id",
      "Abuse->FlaggedAccount->Actor->Avatars"."width" AS "Abuse.FlaggedAccount.Actor.Avatars.width",
      "Abuse->FlaggedAccount->Actor->Avatars"."type" AS "Abuse.FlaggedAccount.Actor.Avatars.type",
      "Abuse->FlaggedAccount->Actor->Avatars"."filename" AS "Abuse.FlaggedAccount.Actor.Avatars.filename",
      "Abuse->FlaggedAccount->Actor->Server"."id" AS "Abuse.FlaggedAccount.Actor.Server.id",
      "Abuse->FlaggedAccount->Actor->Server"."host" AS "Abuse.FlaggedAccount.Actor.Server.host",
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
      "Account"."id" AS "Account.id",
      "Account"."name" AS "Account.name",
      "Account->Actor"."id" AS "Account.Actor.id",
      "Account->Actor"."preferredUsername" AS "Account.Actor.preferredUsername",
      "Account->Actor->Avatars"."id" AS "Account.Actor.Avatars.id",
      "Account->Actor->Avatars"."width" AS "Account.Actor.Avatars.width",
      "Account->Actor->Avatars"."type" AS "Account.Actor.Avatars.type",
      "Account->Actor->Avatars"."filename" AS "Account.Actor.Avatars.filename",
      "Account->Actor->Server"."id" AS "Account.Actor.Server.id",
      "Account->Actor->Server"."host" AS "Account.Actor.Server.host",
      "UserRegistration"."id" AS "UserRegistration.id",
      "UserRegistration"."username" AS "UserRegistration.username",
      "VideoCaption"."id" AS "VideoCaption.id",
      "VideoCaption"."language" AS "VideoCaption.language",
      "VideoCaption->Video"."id" AS "VideoCaption.Video.id",
      "VideoCaption->Video"."uuid" AS "VideoCaption.Video.uuid",
      "VideoCaption->Video"."name" AS "VideoCaption.Video.name",
      "VideoCaption->Video"."state" AS "VideoCaption.Video.state"`
  }

  private getJoins () {
    return `
    LEFT JOIN (
      "video" AS "Video"
      INNER JOIN "videoChannel" AS "Video->VideoChannel" ON "Video"."channelId" = "Video->VideoChannel"."id"
      INNER JOIN "actor" AS "Video->VideoChannel->Actor" ON "Video->VideoChannel"."actorId" = "Video->VideoChannel->Actor"."id"
      LEFT JOIN "actorImage" AS "Video->VideoChannel->Actor->Avatars"
        ON "Video->VideoChannel->Actor"."id" = "Video->VideoChannel->Actor->Avatars"."actorId"
        AND "Video->VideoChannel->Actor->Avatars"."type" = ${ActorImageType.AVATAR}
      LEFT JOIN "server" AS "Video->VideoChannel->Actor->Server"
        ON "Video->VideoChannel->Actor"."serverId" = "Video->VideoChannel->Actor->Server"."id"
    ) ON "UserNotificationModel"."videoId" = "Video"."id"

    LEFT JOIN (
      "videoComment" AS "VideoComment"
      INNER JOIN "account" AS "VideoComment->Account" ON "VideoComment"."accountId" = "VideoComment->Account"."id"
      INNER JOIN "actor" AS "VideoComment->Account->Actor" ON "VideoComment->Account"."actorId" = "VideoComment->Account->Actor"."id"
      LEFT JOIN "actorImage" AS "VideoComment->Account->Actor->Avatars"
        ON "VideoComment->Account->Actor"."id" = "VideoComment->Account->Actor->Avatars"."actorId"
        AND "VideoComment->Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR}
      LEFT JOIN "server" AS "VideoComment->Account->Actor->Server"
        ON "VideoComment->Account->Actor"."serverId" = "VideoComment->Account->Actor->Server"."id"
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
      INNER JOIN "actor" AS "Abuse->FlaggedAccount->Actor" ON "Abuse->FlaggedAccount"."actorId" = "Abuse->FlaggedAccount->Actor"."id"
      LEFT JOIN "actorImage" AS "Abuse->FlaggedAccount->Actor->Avatars"
        ON "Abuse->FlaggedAccount->Actor"."id" = "Abuse->FlaggedAccount->Actor->Avatars"."actorId"
        AND "Abuse->FlaggedAccount->Actor->Avatars"."type" = ${ActorImageType.AVATAR}
      LEFT JOIN "server" AS "Abuse->FlaggedAccount->Actor->Server"
        ON "Abuse->FlaggedAccount->Actor"."serverId" = "Abuse->FlaggedAccount->Actor->Server"."id"
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
      LEFT JOIN "actorImage" AS "ActorFollow->ActorFollower->Avatars"
        ON "ActorFollow->ActorFollower"."id" = "ActorFollow->ActorFollower->Avatars"."actorId"
        AND "ActorFollow->ActorFollower->Avatars"."type" = ${ActorImageType.AVATAR}
      LEFT JOIN "server" AS "ActorFollow->ActorFollower->Server"
        ON "ActorFollow->ActorFollower"."serverId" = "ActorFollow->ActorFollower->Server"."id"
      INNER JOIN "actor" AS "ActorFollow->ActorFollowing" ON "ActorFollow"."targetActorId" = "ActorFollow->ActorFollowing"."id"
      LEFT JOIN "videoChannel" AS "ActorFollow->ActorFollowing->VideoChannel"
        ON "ActorFollow->ActorFollowing"."id" = "ActorFollow->ActorFollowing->VideoChannel"."actorId"
      LEFT JOIN "account" AS "ActorFollow->ActorFollowing->Account"
        ON "ActorFollow->ActorFollowing"."id" = "ActorFollow->ActorFollowing->Account"."actorId"
      LEFT JOIN "server" AS "ActorFollow->ActorFollowing->Server"
        ON "ActorFollow->ActorFollowing"."serverId" = "ActorFollow->ActorFollowing->Server"."id"
    ) ON "UserNotificationModel"."actorFollowId" = "ActorFollow"."id"

    LEFT JOIN (
      "account" AS "Account"
      INNER JOIN "actor" AS "Account->Actor" ON "Account"."actorId" = "Account->Actor"."id"
      LEFT JOIN "actorImage" AS "Account->Actor->Avatars"
        ON "Account->Actor"."id" = "Account->Actor->Avatars"."actorId"
        AND "Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR}
      LEFT JOIN "server" AS "Account->Actor->Server" ON "Account->Actor"."serverId" = "Account->Actor->Server"."id"
    ) ON "UserNotificationModel"."accountId" = "Account"."id"

    LEFT JOIN "userRegistration" as "UserRegistration" ON "UserNotificationModel"."userRegistrationId" = "UserRegistration"."id"

    LEFT JOIN (
      "videoCaption" AS "VideoCaption"
      INNER JOIN "video" AS "VideoCaption->Video" ON "VideoCaption"."videoId" = "VideoCaption->Video"."id"
    ) ON "UserNotificationModel"."videoCaptionId" = "VideoCaption"."id"`
  }
}
