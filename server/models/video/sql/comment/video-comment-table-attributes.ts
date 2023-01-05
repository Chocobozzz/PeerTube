export class VideoCommentTableAttributes {

  getVideoCommentAttributes () {
    return [
      '"VideoCommentModel"."id"',
      '"VideoCommentModel"."url"',
      '"VideoCommentModel"."deletedAt"',
      '"VideoCommentModel"."updatedAt"',
      '"VideoCommentModel"."createdAt"',
      '"VideoCommentModel"."text"',
      '"VideoCommentModel"."originCommentId"',
      '"VideoCommentModel"."inReplyToCommentId"',
      '"VideoCommentModel"."videoId"',
      '"VideoCommentModel"."accountId"'
    ].join(', ')
  }

  getAccountAttributes () {
    return [
      `"Account"."id" AS "Account.id"`,
      `"Account"."name" AS "Account.name"`,
      `"Account"."description" AS "Account.description"`,
      `"Account"."createdAt" AS "Account.createdAt"`,
      `"Account"."updatedAt" AS "Account.updatedAt"`,
      `"Account"."actorId" AS "Account.actorId"`,
      `"Account"."userId" AS "Account.userId"`,
      `"Account"."applicationId" AS "Account.applicationId"`
    ].join(', ')
  }

  getVideoAttributes () {
    return [
      `"Video"."id" AS "Video.id"`,
      `"Video"."uuid" AS "Video.uuid"`,
      `"Video"."name" AS "Video.name"`
    ].join(', ')
  }

  getActorAttributes () {
    return [
      `"Account->Actor"."id" AS "Account.Actor.id"`,
      `"Account->Actor"."type" AS "Account.Actor.type"`,
      `"Account->Actor"."preferredUsername" AS "Account.Actor.preferredUsername"`,
      `"Account->Actor"."url" AS "Account.Actor.url"`,
      `"Account->Actor"."followersCount" AS "Account.Actor.followersCount"`,
      `"Account->Actor"."followingCount" AS "Account.Actor.followingCount"`,
      `"Account->Actor"."remoteCreatedAt" AS "Account.Actor.remoteCreatedAt"`,
      `"Account->Actor"."serverId" AS "Account.Actor.serverId"`,
      `"Account->Actor"."createdAt" AS "Account.Actor.createdAt"`,
      `"Account->Actor"."updatedAt" AS "Account.Actor.updatedAt"`
    ].join(', ')
  }

  getServerAttributes () {
    return [
      `"Account->Actor->Server"."id" AS "Account.Actor.Server.id"`,
      `"Account->Actor->Server"."host" AS "Account.Actor.Server.host"`,
      `"Account->Actor->Server"."redundancyAllowed" AS "Account.Actor.Server.redundancyAllowed"`,
      `"Account->Actor->Server"."createdAt" AS "Account.Actor.Server.createdAt"`,
      `"Account->Actor->Server"."updatedAt" AS "Account.Actor.Server.updatedAt"`
    ].join(', ')
  }

  getAvatarAttributes () {
    return [
      `"Account->Actor->Avatars"."id" AS "Account.Actor.Avatars.id"`,
      `"Account->Actor->Avatars"."filename" AS "Account.Actor.Avatars.filename"`,
      `"Account->Actor->Avatars"."height" AS "Account.Actor.Avatars.height"`,
      `"Account->Actor->Avatars"."width" AS "Account.Actor.Avatars.width"`,
      `"Account->Actor->Avatars"."fileUrl" AS "Account.Actor.Avatars.fileUrl"`,
      `"Account->Actor->Avatars"."onDisk" AS "Account.Actor.Avatars.onDisk"`,
      `"Account->Actor->Avatars"."type" AS "Account.Actor.Avatars.type"`,
      `"Account->Actor->Avatars"."actorId" AS "Account.Actor.Avatars.actorId"`,
      `"Account->Actor->Avatars"."createdAt" AS "Account.Actor.Avatars.createdAt"`,
      `"Account->Actor->Avatars"."updatedAt" AS "Account.Actor.Avatars.updatedAt"`
    ].join(', ')
  }
}
