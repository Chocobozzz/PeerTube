import { ActorImageType, VideoChannelCollaboratorState, VideoPlaylistType } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { Sequelize } from 'sequelize'
import { UserTableAttributes } from './user-table-attributes.js'

export interface ListUserOptions extends AbstractListQueryOptions {
  userId: number
}

export class UserListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new UserTableAttributes()

  private builtAccountJoin = false
  private builtChannelsJoin = false
  private builtChannelCollabsJoin = false
  private builtPlaylistsJoin = false
  private builtNotificationSettingsJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListUserOptions
  ) {
    super(sequelize, { modelName: 'UserModel', tableName: 'user' }, options)
  }

  protected buildSubQueryWhere () {
    const where: string[] = []

    if (this.options.userId) {
      where.push('"UserModel"."id" = :userId')

      this.replacements.userId = this.options.userId
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  private buildAccountJoin () {
    if (this.builtAccountJoin) return

    this.join += ' INNER JOIN "account" "Account" ON "Account"."userId" = "UserModel"."id" ' +
      'INNER JOIN "actor" "Account->Actor" ON "Account->Actor"."accountId" = "Account"."id" ' +
      'LEFT JOIN "server" "Account->Actor->Server" ON "Account->Actor"."serverId" = "Account->Actor->Server"."id" ' +
      'LEFT JOIN "actorImage" "Account->Actor->Avatars" ON "Account->Actor->Avatars"."actorId" = "Account->Actor"."id" ' +
      `  AND "Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR} `

    this.builtAccountJoin = true
  }

  private buildChannelsJoin () {
    if (this.builtChannelsJoin) return

    this.join += ' LEFT JOIN "videoChannel" "Account->VideoChannels" ON "Account"."id" = "Account->VideoChannels"."accountId" ' +
      'LEFT JOIN "actor" "Account->VideoChannels->Actor" ' +
      '  ON "Account->VideoChannels->Actor"."videoChannelId" = "Account->VideoChannels"."id" ' +
      'LEFT JOIN "server" "Account->VideoChannels->Actor->Server" ' +
      '  ON "Account->VideoChannels->Actor->Server"."id" = "Account->VideoChannels->Actor"."serverId" ' +
      'LEFT JOIN "actorImage" "Account->VideoChannels->Actor->Avatars" ' +
      '  ON "Account->VideoChannels->Actor->Avatars"."actorId" = "Account->VideoChannels->Actor"."id" ' +
      `  AND "Account->VideoChannels->Actor->Avatars"."type" = ${ActorImageType.AVATAR} ` +
      'LEFT JOIN "actorImage" "Account->VideoChannels->Actor->Banners" ' +
      '  ON "Account->VideoChannels->Actor->Banners"."actorId" = "Account->VideoChannels->Actor"."id" ' +
      `  AND "Account->VideoChannels->Actor->Banners"."type" = ${ActorImageType.BANNER} `

    this.builtChannelsJoin = true
  }

  private buildChannelCollabs () {
    if (this.builtChannelCollabsJoin) return

    this.join += 'LEFT JOIN "videoChannelCollaborator" AS "Account->Collabs" ' +
      `ON "Account"."id" = "Account->Collabs"."accountId" AND "Account->Collabs"."state" = ${VideoChannelCollaboratorState.ACCEPTED} ` +
      'LEFT JOIN (' +
      '  "videoChannel" "Account->Collabs->Channel" ' +
      '  INNER JOIN "actor" AS "Account->Collabs->Channel->Actor" ' +
      '    ON "Account->Collabs->Channel"."id" = "Account->Collabs->Channel->Actor"."videoChannelId" ' +
      '  LEFT JOIN "server" AS "Account->Collabs->Channel->Actor->Server" ' +
      '    ON "Account->Collabs->Channel->Actor"."serverId" = "Account->Collabs->Channel->Actor->Server"."id"' +
      '  LEFT JOIN "actorImage" AS "Account->Collabs->Channel->Actor->Avatars" ' +
      '    ON "Account->Collabs->Channel->Actor"."id" = "Account->Collabs->Channel->Actor->Avatars"."actorId"' +
      `    AND "Account->Collabs->Channel->Actor->Avatars"."type" = ${ActorImageType.AVATAR}` +
      '  LEFT JOIN "actorImage" AS "Account->Collabs->Channel->Actor->Banners" ' +
      '    ON "Account->Collabs->Channel->Actor"."id" = "Account->Collabs->Channel->Actor->Banners"."actorId" ' +
      `    AND "Account->Collabs->Channel->Actor->Banners"."type" = ${ActorImageType.BANNER} ` +
      ') ON "Account->Collabs"."channelId" = "Account->Collabs->Channel"."id"'

    this.builtChannelCollabsJoin = true
  }

  private buildPlaylistsJoin () {
    if (this.builtPlaylistsJoin) return

    this.join += 'INNER JOIN "videoPlaylist" AS "Account->VideoPlaylists" ' +
      'ON "Account"."id" = "Account->VideoPlaylists"."ownerAccountId" ' +
      `AND "Account->VideoPlaylists"."type" = ${VideoPlaylistType.WATCH_LATER} `

    this.builtPlaylistsJoin = true
  }

  private buildNotificationSettingsJoin () {
    if (this.builtNotificationSettingsJoin) return

    this.join += 'INNER JOIN "userNotificationSetting" AS "NotificationSetting" ON "UserModel"."id" = "NotificationSetting"."userId"'

    this.builtNotificationSettingsJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildAccountJoin()
    this.buildChannelsJoin()
    this.buildChannelCollabs()
    this.buildPlaylistsJoin()
    this.buildNotificationSettingsJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getAccountAttributes(),
      this.tableAttributes.getAccountActorAttributes(),
      this.tableAttributes.getAccountServerAttributes(),
      this.tableAttributes.getAccountAvatarAttributes(),
      this.tableAttributes.getChannelAttributes(),
      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes(),
      this.tableAttributes.getChannelAvatarAttributes(),
      this.tableAttributes.getChannelBannerAttributes(),
      this.tableAttributes.getPlaylistAttributes(),
      this.tableAttributes.getNotificationSettingAttributes(),
      this.tableAttributes.getCollabAttributes(),
      this.tableAttributes.getCollabChannelAttributes(),
      this.tableAttributes.getCollabChannelActorAttributes(),
      this.tableAttributes.getCollabChannelActorServerAttributes(),
      this.tableAttributes.getCollabChannelActorAvatarAttributes(),
      this.tableAttributes.getCollabChannelActorBannerAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    // empty
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getUserAttributes()
    ]
  }
}
