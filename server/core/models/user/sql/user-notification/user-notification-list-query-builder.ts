import { ActorImageType, UserNotificationType_Type } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { Sequelize } from 'sequelize'

export interface ListNotificationsOptions extends AbstractListQueryOptions {
  userId: number
  unread?: boolean
  typeOneOf?: UserNotificationType_Type[]
}

export class UserNotificationListQueryBuilder extends AbstractListQuery {
  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListNotificationsOptions
  ) {
    super(sequelize, { modelName: 'UserNotificationModel', tableName: 'userNotification' }, options)
  }

  protected buildSubQueryWhere () {
    this.subQueryWhere = 'WHERE "UserNotificationModel"."userId" = :userId '
    this.replacements.userId = this.options.userId

    if (this.options.unread === true) {
      this.subQueryWhere += 'AND "UserNotificationModel"."read" IS FALSE '
    } else if (this.options.unread === false) {
      this.subQueryWhere += 'AND "UserNotificationModel"."read" IS TRUE '
    }

    if (this.options.typeOneOf) {
      this.subQueryWhere += 'AND "UserNotificationModel"."type" IN (:typeOneOf) '
      this.replacements.typeOneOf = this.options.typeOneOf
    }
  }

  protected buildSubQueryJoin () {
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      `*`
    ]
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      `"UserNotificationModel"."id"`,
      `"UserNotificationModel"."type"`,
      `"UserNotificationModel"."read"`,
      `"UserNotificationModel"."data"`,
      `"UserNotificationModel"."createdAt"`,
      `"UserNotificationModel"."updatedAt"`,

      `"Video"."id" AS "Video.id"`,
      `"Video"."uuid" AS "Video.uuid"`,
      `"Video"."name" AS "Video.name"`,
      `"Video"."state" AS "Video.state"`,
      ...this.getAccountOrChannelAttributes('Video->VideoChannel', 'Video.VideoChannel'),

      `"VideoComment"."id" AS "VideoComment.id"`,
      `"VideoComment"."originCommentId" AS "VideoComment.originCommentId"`,
      `"VideoComment"."heldForReview" AS "VideoComment.heldForReview"`,
      `"VideoComment->Video"."id" AS "VideoComment.Video.id"`,
      `"VideoComment->Video"."uuid" AS "VideoComment.Video.uuid"`,
      `"VideoComment->Video"."name" AS "VideoComment.Video.name"`,
      `"VideoComment->Video"."state" AS "VideoComment.Video.state"`,
      ...this.getAccountOrChannelAttributes('VideoComment->Account', 'VideoComment.Account'),

      `"Abuse"."id" AS "Abuse.id"`,
      `"Abuse"."state" AS "Abuse.state"`,
      `"Abuse->VideoAbuse"."id" AS "Abuse.VideoAbuse.id"`,
      `"Abuse->VideoAbuse->Video"."id" AS "Abuse.VideoAbuse.Video.id"`,
      `"Abuse->VideoAbuse->Video"."uuid" AS "Abuse.VideoAbuse.Video.uuid"`,
      `"Abuse->VideoAbuse->Video"."name" AS "Abuse.VideoAbuse.Video.name"`,
      `"Abuse->VideoAbuse->Video"."state" AS "Abuse.VideoAbuse.Video.state"`,
      `"Abuse->VideoCommentAbuse"."id" AS "Abuse.VideoCommentAbuse.id"`,
      `"Abuse->VideoCommentAbuse->VideoComment"."id" AS "Abuse.VideoCommentAbuse.VideoComment.id"`,
      `"Abuse->VideoCommentAbuse->VideoComment"."originCommentId" AS "Abuse.VideoCommentAbuse.VideoComment.originCommentId"`,
      `"Abuse->VideoCommentAbuse->VideoComment->Video"."id" AS "Abuse.VideoCommentAbuse.VideoComment.Video.id"`,
      `"Abuse->VideoCommentAbuse->VideoComment->Video"."name" AS "Abuse.VideoCommentAbuse.VideoComment.Video.name"`,
      `"Abuse->VideoCommentAbuse->VideoComment->Video"."uuid" AS "Abuse.VideoCommentAbuse.VideoComment.Video.uuid"`,
      `"Abuse->VideoCommentAbuse->VideoComment->Video"."state" AS "Abuse.VideoCommentAbuse.VideoComment.Video.state"`,
      ...this.getAccountOrChannelAttributes('Abuse->FlaggedAccount', 'Abuse.FlaggedAccount'),

      `"VideoBlacklist"."id" AS "VideoBlacklist.id"`,
      `"VideoBlacklist->Video"."id" AS "VideoBlacklist.Video.id"`,
      `"VideoBlacklist->Video"."uuid" AS "VideoBlacklist.Video.uuid"`,
      `"VideoBlacklist->Video"."name" AS "VideoBlacklist.Video.name"`,
      `"VideoBlacklist->Video"."state" AS "VideoBlacklist.Video.state"`,

      `"VideoImport"."id" AS "VideoImport.id"`,
      `"VideoImport"."magnetUri" AS "VideoImport.magnetUri"`,
      `"VideoImport"."targetUrl" AS "VideoImport.targetUrl"`,
      `"VideoImport"."torrentName" AS "VideoImport.torrentName"`,
      `"VideoImport->Video"."id" AS "VideoImport.Video.id"`,
      `"VideoImport->Video"."uuid" AS "VideoImport.Video.uuid"`,
      `"VideoImport->Video"."name" AS "VideoImport.Video.name"`,
      `"VideoImport->Video"."state" AS "VideoImport.Video.state"`,

      `"Plugin"."id" AS "Plugin.id"`,
      `"Plugin"."name" AS "Plugin.name"`,
      `"Plugin"."type" AS "Plugin.type"`,
      `"Plugin"."latestVersion" AS "Plugin.latestVersion"`,

      `"Application"."id" AS "Application.id"`,
      `"Application"."latestPeerTubeVersion" AS "Application.latestPeerTubeVersion"`,

      `"ActorFollow"."id" AS "ActorFollow.id"`,
      `"ActorFollow"."state" AS "ActorFollow.state"`,
      `"ActorFollow->ActorFollower"."id" AS "ActorFollow.ActorFollower.id"`,
      `"ActorFollow->ActorFollower"."preferredUsername" AS "ActorFollow.ActorFollower.preferredUsername"`,
      `"ActorFollow->ActorFollower->Account"."id" AS "ActorFollow.ActorFollower.Account.id"`,
      `"ActorFollow->ActorFollower->Account"."name" AS "ActorFollow.ActorFollower.Account.name"`,
      `"ActorFollow->ActorFollower->Avatars"."id" AS "ActorFollow.ActorFollower.Avatars.id"`,
      `"ActorFollow->ActorFollower->Avatars"."width" AS "ActorFollow.ActorFollower.Avatars.width"`,
      `"ActorFollow->ActorFollower->Avatars"."type" AS "ActorFollow.ActorFollower.Avatars.type"`,
      `"ActorFollow->ActorFollower->Avatars"."filename" AS "ActorFollow.ActorFollower.Avatars.filename"`,
      `"ActorFollow->ActorFollower->Server"."id" AS "ActorFollow.ActorFollower.Server.id"`,
      `"ActorFollow->ActorFollower->Server"."host" AS "ActorFollow.ActorFollower.Server.host"`,
      `"ActorFollow->ActorFollowing"."id" AS "ActorFollow.ActorFollowing.id"`,
      `"ActorFollow->ActorFollowing"."preferredUsername" AS "ActorFollow.ActorFollowing.preferredUsername"`,
      `"ActorFollow->ActorFollowing"."type" AS "ActorFollow.ActorFollowing.type"`,
      `"ActorFollow->ActorFollowing->VideoChannel"."id" AS "ActorFollow.ActorFollowing.VideoChannel.id"`,
      `"ActorFollow->ActorFollowing->VideoChannel"."name" AS "ActorFollow.ActorFollowing.VideoChannel.name"`,
      `"ActorFollow->ActorFollowing->Account"."id" AS "ActorFollow.ActorFollowing.Account.id"`,
      `"ActorFollow->ActorFollowing->Account"."name" AS "ActorFollow.ActorFollowing.Account.name"`,
      `"ActorFollow->ActorFollowing->Server"."id" AS "ActorFollow.ActorFollowing.Server.id"`,
      `"ActorFollow->ActorFollowing->Server"."host" AS "ActorFollow.ActorFollowing.Server.host"`,

      ...this.getAccountOrChannelAttributes('Account', 'Account'),

      `"UserRegistration"."id" AS "UserRegistration.id"`,
      `"UserRegistration"."username" AS "UserRegistration.username"`,

      `"VideoCaption"."id" AS "VideoCaption.id"`,
      `"VideoCaption"."language" AS "VideoCaption.language"`,
      `"VideoCaption->Video"."id" AS "VideoCaption.Video.id"`,
      `"VideoCaption->Video"."uuid" AS "VideoCaption.Video.uuid"`,
      `"VideoCaption->Video"."name" AS "VideoCaption.Video.name"`,
      `"VideoCaption->Video"."state" AS "VideoCaption.Video.state"`,

      `"ChannelCollab"."id" AS "ChannelCollab.id"`,
      `"ChannelCollab"."state" AS "ChannelCollab.state"`,
      ...this.getAccountOrChannelAttributes('ChannelCollab->Account', 'ChannelCollab.Account'),
      ...this.getAccountOrChannelAttributes('ChannelCollab->Channel->Account', 'ChannelCollab.Channel.Account'),
      ...this.getAccountOrChannelAttributes('ChannelCollab->Channel', 'ChannelCollab.Channel')
    ]
  }

  protected buildQueryJoin () {
    this.join = `
    LEFT JOIN (
      "video" AS "Video"
      ${this.getChannelJoin('Video', 'channelId')}
    ) ON "UserNotificationModel"."videoId" = "Video"."id"

    LEFT JOIN (
      "videoComment" AS "VideoComment"
      ${this.getAccountJoin('VideoComment', 'accountId')}
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
      ${this.getActorJoin('Abuse->FlaggedAccount', 'accountId')}
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
        ON "ActorFollow->ActorFollower"."accountId" = "ActorFollow->ActorFollower->Account"."id"
      ${this.getActorImageJoin('ActorFollow->ActorFollower')}
      ${this.getActorServerJoin('ActorFollow->ActorFollower')}

      INNER JOIN "actor" AS "ActorFollow->ActorFollowing" ON "ActorFollow"."targetActorId" = "ActorFollow->ActorFollowing"."id"
      LEFT JOIN "videoChannel" AS "ActorFollow->ActorFollowing->VideoChannel"
        ON "ActorFollow->ActorFollowing"."videoChannelId" = "ActorFollow->ActorFollowing->VideoChannel"."id"
      LEFT JOIN "account" AS "ActorFollow->ActorFollowing->Account"
        ON "ActorFollow->ActorFollowing"."accountId" = "ActorFollow->ActorFollowing->Account"."id"
      ${this.getActorServerJoin('ActorFollow->ActorFollowing')}
    ) ON "UserNotificationModel"."actorFollowId" = "ActorFollow"."id"

    LEFT JOIN (
      "account" AS "Account"
      ${this.getActorJoin('Account', 'accountId')}
    ) ON "UserNotificationModel"."accountId" = "Account"."id"

    LEFT JOIN "userRegistration" as "UserRegistration" ON "UserNotificationModel"."userRegistrationId" = "UserRegistration"."id"

    LEFT JOIN (
      "videoCaption" AS "VideoCaption"
      INNER JOIN "video" AS "VideoCaption->Video" ON "VideoCaption"."videoId" = "VideoCaption->Video"."id"
    ) ON "UserNotificationModel"."videoCaptionId" = "VideoCaption"."id"

    LEFT JOIN (
      "videoChannelCollaborator" AS "ChannelCollab"
      ${this.getAccountJoin('ChannelCollab', 'accountId')}
      ${this.getChannelJoin('ChannelCollab', 'channelId', 'Channel')}
      ${this.getAccountJoin('ChannelCollab->Channel', 'accountId')}
    ) ON "UserNotificationModel"."channelCollaboratorId" = "ChannelCollab"."id"`
  }

  // ---------------------------------------------------------------------------

  private getAccountOrChannelAttributes (tableName: string, alias: string) {
    return [
      `"${tableName}"."id" AS "${alias}.id"`,
      `"${tableName}"."name" AS "${alias}.name"`,
      `"${tableName}->Actor"."id" AS "${alias}.Actor.id"`,
      `"${tableName}->Actor"."preferredUsername" AS "${alias}.Actor.preferredUsername"`,
      `"${tableName}->Actor->Avatars"."id" AS "${alias}.Actor.Avatars.id"`,
      `"${tableName}->Actor->Avatars"."width" AS "${alias}.Actor.Avatars.width"`,
      `"${tableName}->Actor->Avatars"."type" AS "${alias}.Actor.Avatars.type"`,
      `"${tableName}->Actor->Avatars"."filename" AS "${alias}.Actor.Avatars.filename"`,
      `"${tableName}->Actor->Server"."id" AS "${alias}.Actor.Server.id"`,
      `"${tableName}->Actor->Server"."host" AS "${alias}.Actor.Server.host"`
    ]
  }

  private getAccountJoin (tableName: string, columnJoin: string) {
    return `INNER JOIN "account" AS "${tableName}->Account" ON "${tableName}"."${columnJoin}" = "${tableName}->Account"."id" ` +
      this.getActorJoin(`${tableName}->Account`, 'accountId')
  }

  private getChannelJoin (tableName: string, columnJoin: string, aliasTableName = 'VideoChannel') {
    // eslint-disable-next-line max-len
    return `INNER JOIN "videoChannel" AS "${tableName}->${aliasTableName}" ON "${tableName}"."${columnJoin}" = "${tableName}->${aliasTableName}".id ` +
      this.getActorJoin(`${tableName}->${aliasTableName}`, 'videoChannelId')
  }

  private getActorJoin (tableName: string, column: string) {
    return `INNER JOIN "actor" AS "${tableName}->Actor" ON "${tableName}"."id" = "${tableName}->Actor"."${column}" ` +
      this.getActorImageJoin(`${tableName}->Actor`) +
      this.getActorServerJoin(`${tableName}->Actor`)
  }

  private getActorImageJoin (tableName: string) {
    return `LEFT JOIN "actorImage" AS "${tableName}->Avatars"
        ON "${tableName}"."id" = "${tableName}->Avatars"."actorId"
        AND "${tableName}->Avatars"."type" = ${ActorImageType.AVATAR} `
  }

  private getActorServerJoin (tableName: string) {
    return `LEFT JOIN "server" AS "${tableName}->Server"
        ON "${tableName}"."serverId" = "${tableName}->Server"."id" `
  }
}
