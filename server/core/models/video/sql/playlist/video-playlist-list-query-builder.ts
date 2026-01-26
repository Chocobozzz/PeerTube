import { ActorImageType, VideoChannelCollaboratorState, VideoPlaylistPrivacy, VideoPlaylistType_Type } from '@peertube/peertube-models'
import { WEBSERVER } from '@server/initializers/constants.js'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { buildServerIdsFollowedBy, getPlaylistSort } from '@server/models/shared/index.js'
import { Sequelize } from 'sequelize'
import { VideoPlaylistTableAttributes } from './video-playlist-table-attributes.js'

export interface ListVideoPlaylistsOptions extends AbstractListQueryOptions {
  followerActorId?: number
  type?: VideoPlaylistType_Type

  accountId?: number
  includeCollaborationsForAccount?: number

  videoChannelId?: number
  listMyPlaylists?: boolean
  search?: string
  host?: string
  uuids?: string[]
  channelNameOneOf?: string[]
  withVideos?: boolean
}

export class VideoPlaylistListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoPlaylistTableAttributes()

  private builtAccountJoin = false
  private builtVideoChannelJoin = false
  private builtChannelCollaboratorsJoin = false
  private builtAccountAvatarJoin = false
  private builtChannelAvatarJoin = false
  private builtThumbnailJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListVideoPlaylistsOptions
  ) {
    super(sequelize, { modelName: 'VideoPlaylistModel', tableName: 'videoPlaylist' }, options)
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    const where: string[] = []

    if (this.options.host) {
      this.buildAccountJoin()

      if (this.options.host === WEBSERVER.HOST) {
        where.push('"OwnerAccount->Actor"."serverId" IS NULL')
      } else {
        where.push('"OwnerAccount->Actor->Server"."host" = :host')

        this.replacements.host = this.options.host
      }
    }

    if (this.options.listMyPlaylists !== true) {
      where.push('"VideoPlaylistModel"."privacy" = :privacy')

      this.replacements.privacy = VideoPlaylistPrivacy.PUBLIC
    }

    if (this.options.followerActorId) {
      this.buildAccountJoin()

      where.push(
        `(` +
          `"OwnerAccount->Actor"."serverId" IS NULL OR ` +
          `"OwnerAccount->Actor"."serverId" IN ${buildServerIdsFollowedBy(this.options.followerActorId)}` +
          `)`
      )
    }

    if (this.options.accountId) {
      if (this.options.includeCollaborationsForAccount) {
        this.buildChannelCollaboratorsJoin()

        where.push(
          `(` +
            `  "VideoPlaylistModel"."ownerAccountId" = :accountId OR ` +
            `  "VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId` +
            `)`
        )

        this.replacements.accountId = this.options.accountId
        this.replacements.collaborationAccountId = this.options.includeCollaborationsForAccount
      } else {
        where.push('"VideoPlaylistModel"."ownerAccountId" = :accountId')

        this.replacements.accountId = this.options.accountId
      }
    }

    if (this.options.videoChannelId) {
      if (this.options.includeCollaborationsForAccount) {
        this.buildChannelCollaboratorsJoin()

        where.push(
          `(` +
            `  "VideoPlaylistModel"."videoChannelId" = :videoChannelId OR ` +
            `  "VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId` +
            `)`
        )

        this.replacements.videoChannelId = this.options.videoChannelId
        this.replacements.collaborationAccountId = this.options.includeCollaborationsForAccount
      } else {
        where.push('"VideoPlaylistModel"."videoChannelId" = :videoChannelId')

        this.replacements.videoChannelId = this.options.videoChannelId
      }
    }

    if (this.options.channelNameOneOf && this.options.channelNameOneOf.length !== 0) {
      this.buildChannelJoin()

      where.push('"VideoChannel->Actor"."preferredUsername" IN (:channelNameOneOf)')
      this.replacements.channelNameOneOf = this.options.channelNameOneOf
    }

    if (this.options.type) {
      where.push('"VideoPlaylistModel"."type" = :type')

      this.replacements.type = this.options.type
    }

    if (this.options.uuids) {
      where.push('"VideoPlaylistModel"."uuid" IN (:uuids)')

      this.replacements.uuids = this.options.uuids
    }

    if (this.options.withVideos === true) {
      where.push(`(${this.getTotalVideosQuery()}) != 0`)
    }

    if (this.options.search) {
      const escapedSearch = this.sequelize.escape(this.options.search)
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      this.subQueryAttributes.push(
        `word_similarity(lower(immutable_unaccent(${escapedSearch})), lower(immutable_unaccent("VideoPlaylistModel"."name"))) as similarity`
      )

      where.push(
        `(` +
          `lower(immutable_unaccent(${escapedSearch})) <% lower(immutable_unaccent("VideoPlaylistModel"."name")) OR ` +
          `lower(immutable_unaccent("VideoPlaylistModel"."name")) LIKE lower(immutable_unaccent(${escapedLikeSearch}))` +
          `)`
      )
    } else {
      this.subQueryAttributes.push('0 as similarity')
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  private buildAccountJoin () {
    if (this.builtAccountJoin) return

    this.subQueryJoin += ' INNER JOIN "account" "OwnerAccount" ON "OwnerAccount"."id" = "VideoPlaylistModel"."ownerAccountId" ' +
      'INNER JOIN "actor" "OwnerAccount->Actor" ON "OwnerAccount->Actor"."accountId" = "OwnerAccount"."id" ' +
      'LEFT JOIN "server" "OwnerAccount->Actor->Server" ON "OwnerAccount->Actor"."serverId" = "OwnerAccount->Actor->Server"."id" '

    this.builtAccountJoin = true
  }

  private buildChannelJoin () {
    if (this.builtVideoChannelJoin) return

    this.subQueryJoin += ' LEFT JOIN "videoChannel" "VideoChannel" ON "VideoPlaylistModel"."videoChannelId" = "VideoChannel"."id" ' +
      'LEFT JOIN "actor" "VideoChannel->Actor" ON "VideoChannel->Actor"."videoChannelId" = "VideoChannel"."id" ' +
      'LEFT JOIN "server" "VideoChannel->Actor->Server" ON "VideoChannel->Actor"."serverId" = "VideoChannel->Actor->Server"."id" '

    this.builtVideoChannelJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

    this.buildChannelJoin()

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "VideoChannel->VideoChannelCollaborators" ' +
      'ON "VideoChannel->VideoChannelCollaborators"."channelId" = "VideoChannel"."id" ' +
      'AND "VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "VideoChannel->VideoChannelCollaborators"."accountId" = :accountId '

    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED
    this.replacements.accountId = this.options.accountId

    this.builtChannelCollaboratorsJoin = true
  }

  private buildAccountAvatarsJoin () {
    if (this.builtAccountAvatarJoin) return

    this.join += `LEFT JOIN "actorImage" "OwnerAccount->Actor->Avatars" ` +
      `ON "OwnerAccount->Actor->Avatars"."actorId" = "VideoPlaylistModel"."OwnerAccount.Actor.id" ` +
      `AND "OwnerAccount->Actor->Avatars"."type" = ${ActorImageType.AVATAR} `

    this.builtAccountAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += `LEFT JOIN "actorImage" "VideoChannel->Actor->Avatars" ` +
      `ON "VideoChannel->Actor->Avatars"."actorId" = "VideoPlaylistModel"."VideoChannel.Actor.id" ` +
      `AND "VideoChannel->Actor->Avatars"."type" = ${ActorImageType.AVATAR} `

    this.builtChannelAvatarJoin = true
  }

  private buildThumbnailJoin () {
    if (this.builtThumbnailJoin) return

    this.join += ' LEFT JOIN "thumbnail" "Thumbnail" ON "Thumbnail"."videoPlaylistId" = "VideoPlaylistModel"."id" '

    this.builtThumbnailJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildChannelAvatarsJoin()
    this.buildAccountAvatarsJoin()
    this.buildThumbnailJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getAccountAvatarAttributes(),
      this.tableAttributes.getChannelAvatarAttributes(),
      this.tableAttributes.getThumbnailAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    this.buildAccountJoin()
    this.buildChannelJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getVideoPlaylistAttributes(),

      this.tableAttributes.getChannelAttributes(),
      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes(),

      this.tableAttributes.getAccountAttributes(),
      this.tableAttributes.getAccountActorAttributes(),
      this.tableAttributes.getAccountServerAttributes(),

      this.getTotalVideosAttribute()
    ]
  }

  private getTotalVideosQuery () {
    return `SELECT COUNT("id") FROM "videoPlaylistElement" WHERE "videoPlaylistId" = "VideoPlaylistModel"."id"`
  }

  private getTotalVideosAttribute () {
    return `(${this.getTotalVideosQuery()}) AS "videosLength"`
  }

  protected getSort (sort: string) {
    return getPlaylistSort(sort)
  }

  protected getCalculatedAttributes () {
    return [ 'similarity', 'videosLength' ]
  }
}
