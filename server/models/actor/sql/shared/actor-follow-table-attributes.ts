export class ActorFollowTableAttributes {

  getFollowAttributes () {
    return [
      '"ActorFollowModel"."id"',
      '"ActorFollowModel"."state"',
      '"ActorFollowModel"."score"',
      '"ActorFollowModel"."url"',
      '"ActorFollowModel"."actorId"',
      '"ActorFollowModel"."targetActorId"',
      '"ActorFollowModel"."createdAt"',
      '"ActorFollowModel"."updatedAt"'
    ].join(', ')
  }

  getActorAttributes (actorTableName: string) {
    return [
      `"${actorTableName}"."id" AS "${actorTableName}.id"`,
      `"${actorTableName}"."type" AS "${actorTableName}.type"`,
      `"${actorTableName}"."preferredUsername" AS "${actorTableName}.preferredUsername"`,
      `"${actorTableName}"."url" AS "${actorTableName}.url"`,
      `"${actorTableName}"."publicKey" AS "${actorTableName}.publicKey"`,
      `"${actorTableName}"."privateKey" AS "${actorTableName}.privateKey"`,
      `"${actorTableName}"."followersCount" AS "${actorTableName}.followersCount"`,
      `"${actorTableName}"."followingCount" AS "${actorTableName}.followingCount"`,
      `"${actorTableName}"."inboxUrl" AS "${actorTableName}.inboxUrl"`,
      `"${actorTableName}"."outboxUrl" AS "${actorTableName}.outboxUrl"`,
      `"${actorTableName}"."sharedInboxUrl" AS "${actorTableName}.sharedInboxUrl"`,
      `"${actorTableName}"."followersUrl" AS "${actorTableName}.followersUrl"`,
      `"${actorTableName}"."followingUrl" AS "${actorTableName}.followingUrl"`,
      `"${actorTableName}"."remoteCreatedAt" AS "${actorTableName}.remoteCreatedAt"`,
      `"${actorTableName}"."serverId" AS "${actorTableName}.serverId"`,
      `"${actorTableName}"."createdAt" AS "${actorTableName}.createdAt"`,
      `"${actorTableName}"."updatedAt" AS "${actorTableName}.updatedAt"`
    ].join(', ')
  }

  getServerAttributes (actorTableName: string) {
    return [
      `"${actorTableName}->Server"."id" AS "${actorTableName}.Server.id"`,
      `"${actorTableName}->Server"."host" AS "${actorTableName}.Server.host"`,
      `"${actorTableName}->Server"."redundancyAllowed" AS "${actorTableName}.Server.redundancyAllowed"`,
      `"${actorTableName}->Server"."createdAt" AS "${actorTableName}.Server.createdAt"`,
      `"${actorTableName}->Server"."updatedAt" AS "${actorTableName}.Server.updatedAt"`
    ].join(', ')
  }

  getAvatarAttributes (actorTableName: string) {
    return [
      `"${actorTableName}->Avatars"."id" AS "${actorTableName}.Avatars.id"`,
      `"${actorTableName}->Avatars"."filename" AS "${actorTableName}.Avatars.filename"`,
      `"${actorTableName}->Avatars"."height" AS "${actorTableName}.Avatars.height"`,
      `"${actorTableName}->Avatars"."width" AS "${actorTableName}.Avatars.width"`,
      `"${actorTableName}->Avatars"."fileUrl" AS "${actorTableName}.Avatars.fileUrl"`,
      `"${actorTableName}->Avatars"."onDisk" AS "${actorTableName}.Avatars.onDisk"`,
      `"${actorTableName}->Avatars"."type" AS "${actorTableName}.Avatars.type"`,
      `"${actorTableName}->Avatars"."actorId" AS "${actorTableName}.Avatars.actorId"`,
      `"${actorTableName}->Avatars"."createdAt" AS "${actorTableName}.Avatars.createdAt"`,
      `"${actorTableName}->Avatars"."updatedAt" AS "${actorTableName}.Avatars.updatedAt"`
    ].join(', ')
  }
}
