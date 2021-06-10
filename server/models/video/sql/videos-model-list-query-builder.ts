
import { MUserId } from '@server/types/models'
import { Sequelize } from 'sequelize'
import { AbstractVideosQueryBuilder } from './abstract-videos-query-builder'
import { buildVideosFromRows } from './video-model-builder'
import { BuildVideosListQueryOptions, VideosIdListQueryBuilder } from './videos-id-list-query-builder'

export class VideosModelListQueryBuilder extends AbstractVideosQueryBuilder {
  private attributes: { [key: string]: string }

  private joins: string[] = []

  private innerQuery: string
  private innerSort: string

  constructor (protected readonly sequelize: Sequelize) {
    super()
  }

  queryVideos (options: BuildVideosListQueryOptions) {
    this.buildInnerQuery(options)
    this.buildListQueryFromIdsQuery(options)

    return this.runQuery(true).then(rows => buildVideosFromRows(rows))
  }

  private buildInnerQuery (options: BuildVideosListQueryOptions) {
    const idsQueryBuilder = new VideosIdListQueryBuilder(this.sequelize)
    const { query, sort, replacements } = idsQueryBuilder.getIdsListQueryAndSort(options)

    this.replacements = replacements
    this.innerQuery = query
    this.innerSort = sort
  }

  private buildListQueryFromIdsQuery (options: BuildVideosListQueryOptions) {
    this.attributes = {
      '"video".*': ''
    }

    this.joins = [ 'INNER JOIN "video" ON "tmp"."id" = "video"."id"' ]

    this.includeChannels()
    this.includeAccounts()
    this.includeThumbnails()

    if (options.withFiles) {
      this.includeFiles()
    }

    if (options.user) {
      this.includeUserHistory(options.user)
    }

    if (options.videoPlaylistId) {
      this.includePlaylist(options.videoPlaylistId)
    }

    const select = this.buildSelect()

    this.query = `${select} FROM (${this.innerQuery}) AS "tmp" ${this.joins.join(' ')} ${this.innerSort}`
  }

  private includeChannels () {
    this.attributes = {
      ...this.attributes,

      '"VideoChannel"."id"': '"VideoChannel.id"',
      '"VideoChannel"."name"': '"VideoChannel.name"',
      '"VideoChannel"."description"': '"VideoChannel.description"',
      '"VideoChannel"."actorId"': '"VideoChannel.actorId"',
      '"VideoChannel->Actor"."id"': '"VideoChannel.Actor.id"',
      '"VideoChannel->Actor"."preferredUsername"': '"VideoChannel.Actor.preferredUsername"',
      '"VideoChannel->Actor"."url"': '"VideoChannel.Actor.url"',
      '"VideoChannel->Actor"."serverId"': '"VideoChannel.Actor.serverId"',
      '"VideoChannel->Actor"."avatarId"': '"VideoChannel.Actor.avatarId"',
      '"VideoChannel->Actor->Server"."id"': '"VideoChannel.Actor.Server.id"',
      '"VideoChannel->Actor->Server"."host"': '"VideoChannel.Actor.Server.host"',
      '"VideoChannel->Actor->Avatar"."id"': '"VideoChannel.Actor.Avatar.id"',
      '"VideoChannel->Actor->Avatar"."filename"': '"VideoChannel.Actor.Avatar.filename"',
      '"VideoChannel->Actor->Avatar"."fileUrl"': '"VideoChannel.Actor.Avatar.fileUrl"',
      '"VideoChannel->Actor->Avatar"."onDisk"': '"VideoChannel.Actor.Avatar.onDisk"',
      '"VideoChannel->Actor->Avatar"."createdAt"': '"VideoChannel.Actor.Avatar.createdAt"',
      '"VideoChannel->Actor->Avatar"."updatedAt"': '"VideoChannel.Actor.Avatar.updatedAt"'
    }

    this.joins = this.joins.concat([
      'INNER JOIN "videoChannel" AS "VideoChannel" ON "video"."channelId" = "VideoChannel"."id"',
      'INNER JOIN "actor" AS "VideoChannel->Actor" ON "VideoChannel"."actorId" = "VideoChannel->Actor"."id"',

      'LEFT OUTER JOIN "server" AS "VideoChannel->Actor->Server" ON "VideoChannel->Actor"."serverId" = "VideoChannel->Actor->Server"."id"',
      'LEFT OUTER JOIN "actorImage" AS "VideoChannel->Actor->Avatar" ' +
        'ON "VideoChannel->Actor"."avatarId" = "VideoChannel->Actor->Avatar"."id"'
    ])
  }

  private includeAccounts () {
    this.attributes = {
      ...this.attributes,

      '"VideoChannel->Account"."id"': '"VideoChannel.Account.id"',
      '"VideoChannel->Account"."name"': '"VideoChannel.Account.name"',
      '"VideoChannel->Account->Actor"."id"': '"VideoChannel.Account.Actor.id"',
      '"VideoChannel->Account->Actor"."preferredUsername"': '"VideoChannel.Account.Actor.preferredUsername"',
      '"VideoChannel->Account->Actor"."url"': '"VideoChannel.Account.Actor.url"',
      '"VideoChannel->Account->Actor"."serverId"': '"VideoChannel.Account.Actor.serverId"',
      '"VideoChannel->Account->Actor"."avatarId"': '"VideoChannel.Account.Actor.avatarId"',
      '"VideoChannel->Account->Actor->Server"."id"': '"VideoChannel.Account.Actor.Server.id"',
      '"VideoChannel->Account->Actor->Server"."host"': '"VideoChannel.Account.Actor.Server.host"',
      '"VideoChannel->Account->Actor->Avatar"."id"': '"VideoChannel.Account.Actor.Avatar.id"',
      '"VideoChannel->Account->Actor->Avatar"."filename"': '"VideoChannel.Account.Actor.Avatar.filename"',
      '"VideoChannel->Account->Actor->Avatar"."fileUrl"': '"VideoChannel.Account.Actor.Avatar.fileUrl"',
      '"VideoChannel->Account->Actor->Avatar"."onDisk"': '"VideoChannel.Account.Actor.Avatar.onDisk"',
      '"VideoChannel->Account->Actor->Avatar"."createdAt"': '"VideoChannel.Account.Actor.Avatar.createdAt"',
      '"VideoChannel->Account->Actor->Avatar"."updatedAt"': '"VideoChannel.Account.Actor.Avatar.updatedAt"'
    }

    this.joins = this.joins.concat([
      'INNER JOIN "account" AS "VideoChannel->Account" ON "VideoChannel"."accountId" = "VideoChannel->Account"."id"',
      'INNER JOIN "actor" AS "VideoChannel->Account->Actor" ON "VideoChannel->Account"."actorId" = "VideoChannel->Account->Actor"."id"',

      'LEFT OUTER JOIN "server" AS "VideoChannel->Account->Actor->Server" ' +
        'ON "VideoChannel->Account->Actor"."serverId" = "VideoChannel->Account->Actor->Server"."id"',

      'LEFT OUTER JOIN "actorImage" AS "VideoChannel->Account->Actor->Avatar" ' +
        'ON "VideoChannel->Account->Actor"."avatarId" = "VideoChannel->Account->Actor->Avatar"."id"'
    ])
  }

  private includeThumbnails () {
    this.attributes = {
      ...this.attributes,

      '"Thumbnails"."id"': '"Thumbnails.id"',
      '"Thumbnails"."type"': '"Thumbnails.type"',
      '"Thumbnails"."filename"': '"Thumbnails.filename"'
    }

    this.joins.push('LEFT OUTER JOIN "thumbnail" AS "Thumbnails" ON "video"."id" = "Thumbnails"."videoId"')
  }

  private includeFiles () {
    this.attributes = {
      ...this.attributes,

      '"VideoFiles"."id"': '"VideoFiles.id"',
      '"VideoFiles"."createdAt"': '"VideoFiles.createdAt"',
      '"VideoFiles"."updatedAt"': '"VideoFiles.updatedAt"',
      '"VideoFiles"."resolution"': '"VideoFiles.resolution"',
      '"VideoFiles"."size"': '"VideoFiles.size"',
      '"VideoFiles"."extname"': '"VideoFiles.extname"',
      '"VideoFiles"."filename"': '"VideoFiles.filename"',
      '"VideoFiles"."fileUrl"': '"VideoFiles.fileUrl"',
      '"VideoFiles"."torrentFilename"': '"VideoFiles.torrentFilename"',
      '"VideoFiles"."torrentUrl"': '"VideoFiles.torrentUrl"',
      '"VideoFiles"."infoHash"': '"VideoFiles.infoHash"',
      '"VideoFiles"."fps"': '"VideoFiles.fps"',
      '"VideoFiles"."videoId"': '"VideoFiles.videoId"',

      '"VideoStreamingPlaylists"."id"': '"VideoStreamingPlaylists.id"',
      '"VideoStreamingPlaylists"."playlistUrl"': '"VideoStreamingPlaylists.playlistUrl"',
      '"VideoStreamingPlaylists"."type"': '"VideoStreamingPlaylists.type"',
      '"VideoStreamingPlaylists->VideoFiles"."id"': '"VideoStreamingPlaylists.VideoFiles.id"',
      '"VideoStreamingPlaylists->VideoFiles"."createdAt"': '"VideoStreamingPlaylists.VideoFiles.createdAt"',
      '"VideoStreamingPlaylists->VideoFiles"."updatedAt"': '"VideoStreamingPlaylists.VideoFiles.updatedAt"',
      '"VideoStreamingPlaylists->VideoFiles"."resolution"': '"VideoStreamingPlaylists.VideoFiles.resolution"',
      '"VideoStreamingPlaylists->VideoFiles"."size"': '"VideoStreamingPlaylists.VideoFiles.size"',
      '"VideoStreamingPlaylists->VideoFiles"."extname"': '"VideoStreamingPlaylists.VideoFiles.extname"',
      '"VideoStreamingPlaylists->VideoFiles"."filename"': '"VideoStreamingPlaylists.VideoFiles.filename"',
      '"VideoStreamingPlaylists->VideoFiles"."fileUrl"': '"VideoStreamingPlaylists.VideoFiles.fileUrl"',
      '"VideoStreamingPlaylists->VideoFiles"."torrentFilename"': '"VideoStreamingPlaylists.VideoFiles.torrentFilename"',
      '"VideoStreamingPlaylists->VideoFiles"."torrentUrl"': '"VideoStreamingPlaylists.VideoFiles.torrentUrl"',
      '"VideoStreamingPlaylists->VideoFiles"."infoHash"': '"VideoStreamingPlaylists.VideoFiles.infoHash"',
      '"VideoStreamingPlaylists->VideoFiles"."fps"': '"VideoStreamingPlaylists.VideoFiles.fps"',
      '"VideoStreamingPlaylists->VideoFiles"."videoStreamingPlaylistId"': '"VideoStreamingPlaylists.VideoFiles.videoStreamingPlaylistId"',
      '"VideoStreamingPlaylists->VideoFiles"."videoId"': '"VideoStreamingPlaylists.VideoFiles.videoId"'
    }

    this.joins = this.joins.concat([
      'LEFT JOIN "videoFile" AS "VideoFiles" ON "VideoFiles"."videoId" = "video"."id"',

      'LEFT JOIN "videoStreamingPlaylist" AS "VideoStreamingPlaylists" ON "VideoStreamingPlaylists"."videoId" = "video"."id"',

      'LEFT JOIN "videoFile" AS "VideoStreamingPlaylists->VideoFiles" ' +
        'ON "VideoStreamingPlaylists->VideoFiles"."videoStreamingPlaylistId" = "VideoStreamingPlaylists"."id"'
    ])
  }

  private includeUserHistory (user: MUserId) {
    this.attributes = {
      ...this.attributes,

      '"userVideoHistory"."id"': '"userVideoHistory.id"',
      '"userVideoHistory"."currentTime"': '"userVideoHistory.currentTime"'
    }

    this.joins.push(
      'LEFT OUTER JOIN "userVideoHistory" ' +
      'ON "video"."id" = "userVideoHistory"."videoId" AND "userVideoHistory"."userId" = :userVideoHistoryId'
    )

    this.replacements.userVideoHistoryId = user.id
  }

  private includePlaylist (playlistId: number) {
    this.attributes = {
      ...this.attributes,

      '"VideoPlaylistElement"."createdAt"': '"VideoPlaylistElement.createdAt"',
      '"VideoPlaylistElement"."updatedAt"': '"VideoPlaylistElement.updatedAt"',
      '"VideoPlaylistElement"."url"': '"VideoPlaylistElement.url"',
      '"VideoPlaylistElement"."position"': '"VideoPlaylistElement.position"',
      '"VideoPlaylistElement"."startTimestamp"': '"VideoPlaylistElement.startTimestamp"',
      '"VideoPlaylistElement"."stopTimestamp"': '"VideoPlaylistElement.stopTimestamp"',
      '"VideoPlaylistElement"."videoPlaylistId"': '"VideoPlaylistElement.videoPlaylistId"'
    }

    this.joins.push(
      'INNER JOIN "videoPlaylistElement" as "VideoPlaylistElement" ON "videoPlaylistElement"."videoId" = "video"."id" ' +
      'AND "VideoPlaylistElement"."videoPlaylistId" = :videoPlaylistId'
    )

    this.replacements.videoPlaylistId = playlistId
  }

  private buildSelect () {
    return 'SELECT ' + Object.keys(this.attributes).map(key => {
      const value = this.attributes[key]
      if (value) return `${key} AS ${value}`

      return key
    }).join(', ')
  }
}
