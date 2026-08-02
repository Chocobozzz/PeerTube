import { VideoChannelCollaboratorState, VideoPlaylistType } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { getAvatarsJSONJoin, getBannersJSONJoin } from '@server/models/shared/sql/actor-helpers.js'
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
      getAvatarsJSONJoin({
        attributes: this.tableAttributes.getAvatarAttributesJSON(),
        base: 'Account->Actor->',
        on: '"Account->Actor"."id"'
      })

    this.builtAccountJoin = true
  }

  private buildChannelsJoin () {
    if (this.builtChannelsJoin) return

    this.join += ' LEFT JOIN "videoChannel" "Account->VideoChannels" ON "Account"."id" = "Account->VideoChannels"."accountId" ' +
      'LEFT JOIN "actor" "Account->VideoChannels->Actor" ' +
      '  ON "Account->VideoChannels->Actor"."videoChannelId" = "Account->VideoChannels"."id" ' +
      'LEFT JOIN "server" "Account->VideoChannels->Actor->Server" ' +
      '  ON "Account->VideoChannels->Actor->Server"."id" = "Account->VideoChannels->Actor"."serverId" ' +
      getAvatarsJSONJoin({
        attributes: this.tableAttributes.getAvatarAttributesJSON(),
        base: 'Account->VideoChannels->Actor->',
        on: '"Account->VideoChannels->Actor"."id"'
      }) +
      getBannersJSONJoin({
        attributes: this.tableAttributes.getBannerAttributesJSON(),
        base: 'Account->VideoChannels->Actor->',
        on: '"Account->VideoChannels->Actor"."id"'
      })

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
      '    ON "Account->Collabs->Channel->Actor"."serverId" = "Account->Collabs->Channel->Actor->Server"."id" ' +
      getAvatarsJSONJoin({
        attributes: this.tableAttributes.getAvatarAttributesJSON(),
        base: 'Account->Collabs->Channel->Actor->',
        on: '"Account->Collabs->Channel->Actor"."id"'
      }) +
      getBannersJSONJoin({
        attributes: this.tableAttributes.getBannerAttributesJSON(),
        base: 'Account->Collabs->Channel->Actor->',
        on: '"Account->Collabs->Channel->Actor"."id"'
      }) +
      `  INNER JOIN "account" "Account->Collabs->Channel->Account" ` +
      `    ON "Account->Collabs->Channel"."accountId" = "Account->Collabs->Channel->Account"."id" ` +
      `  INNER JOIN "actor" "Account->Collabs->Channel->Account->Actor" ` +
      `    ON "Account->Collabs->Channel->Account"."id" = "Account->Collabs->Channel->Account->Actor"."accountId" ` +
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
      this.tableAttributes.getCollabChannelActorBannerAttributes(),
      this.tableAttributes.getCollabChannelAccountAttributes(),
      this.tableAttributes.getCollabChannelAccountActorAttributes()
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
