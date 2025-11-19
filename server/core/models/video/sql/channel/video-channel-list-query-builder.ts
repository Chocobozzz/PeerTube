import { ActorImageType, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { WEBSERVER } from '@server/initializers/constants.js'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { buildServerIdsFollowedBy } from '@server/models/shared/index.js'
import { Sequelize } from 'sequelize'
import { VideoChannelTableAttributes } from './video-channel-table-attributes.js'

export interface ListVideoChannelsOptions extends AbstractListQueryOptions {
  actorId?: number
  search?: string
  host?: string
  handles?: string[]
  forCount?: boolean

  accountId?: number

  // If accountId is provided, include channels where the account is a collaborator
  // default: false
  includeCollaborations?: boolean

  statsDaysPrior?: number
}

export class VideoChannelListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoChannelTableAttributes()

  private builtActorJoin = false
  private builtAccountJoin = false
  private builtChannelCollaboratorsJoin = false
  private builtAccountAvatarJoin = false
  private builtChannelAvatarJoin = false
  private builtChannelBannerJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListVideoChannelsOptions
  ) {
    super(sequelize, { modelName: 'VideoChannelModel', tableName: 'videoChannel' }, options)
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    const where: string[] = []

    if (this.options.host) {
      this.buildActorJoin()

      if (this.options.host === WEBSERVER.HOST) {
        where.push('"Actor"."serverId" IS NULL')
      } else {
        where.push('"Actor->Server"."host" = :host')

        this.replacements.host = this.options.host
      }
    }

    // Only list local channels OR channels that are on an instance followed by actorId
    if (this.options.actorId) {
      this.buildActorJoin()

      where.push(
        `(` +
          `"Actor"."serverId" IS NULL OR ` +
          `"Actor"."serverId" IN ${buildServerIdsFollowedBy(this.options.actorId)}` +
          `)`
      )
    }

    if (this.options.accountId) {
      this.buildAccountJoin()

      if (this.options.includeCollaborations !== true) {
        where.push('"VideoChannelModel"."accountId" = :accountId')

        this.replacements.accountId = this.options.accountId
      } else {
        this.buildChannelCollaboratorsJoin()

        where.push(
          `("VideoChannelModel"."accountId" = :accountId OR "VideoChannelCollaborators"."accountId" = :accountId)`
        )

        this.replacements.accountId = this.options.accountId
      }
    }

    if (Array.isArray(this.options.handles) && this.options.handles.length !== 0) {
      this.buildActorJoin()

      const or: string[] = []

      for (const handle of this.options.handles || []) {
        const [ preferredUsername, host ] = handle.split('@')

        const sanitizedPreferredUsername = this.sequelize.escape(preferredUsername.toLowerCase())
        const sanitizedHost = this.sequelize.escape(host)

        if (!host || host === WEBSERVER.HOST) {
          or.push(`(LOWER("Actor"."preferredUsername") = ${sanitizedPreferredUsername} AND "Actor"."serverId" IS NULL)`)
        } else {
          or.push(`(LOWER("Actor"."preferredUsername") = ${sanitizedPreferredUsername} AND "Actor->Server"."host" = ${sanitizedHost})`)
        }
      }

      where.push(`(${or.join(' OR ')})`)
    }

    if (this.options.search) {
      this.buildAccountJoin()

      const escapedSearch = this.sequelize.escape(this.options.search)
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      this.subQueryAttributes.push(
        `word_similarity(lower(immutable_unaccent(${escapedSearch})), lower(immutable_unaccent("VideoChannelModel"."name"))) as similarity`
      )

      where.push(
        `(` +
          `lower(immutable_unaccent(${escapedSearch})) <% lower(immutable_unaccent("VideoChannelModel"."name")) OR ` +
          `lower(immutable_unaccent("VideoChannelModel"."name")) LIKE lower(immutable_unaccent(${escapedLikeSearch})) OR ` +
          `lower(immutable_unaccent("Account"."name")) LIKE lower(immutable_unaccent(${escapedLikeSearch}))` +
          `)`
      )
    } else {
      this.subQueryAttributes.push('0 as similarity')
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  // ---------------------------------------------------------------------------

  private buildActorJoin () {
    if (this.builtActorJoin) return

    this.subQueryJoin += ' INNER JOIN "actor" "Actor" ON "Actor"."videoChannelId" = "VideoChannelModel"."id" ' +
      'LEFT JOIN "server" "Actor->Server" ON "Actor"."serverId" = "Actor->Server"."id" '

    this.builtActorJoin = true
  }

  private buildAccountJoin () {
    if (this.builtAccountJoin) return

    this.subQueryJoin += ' INNER JOIN "account" "Account" ON "Account"."id" = "VideoChannelModel"."accountId" ' +
      'INNER JOIN "actor" "Account->Actor" ON "Account->Actor"."accountId" = "Account"."id" ' +
      'LEFT JOIN "server" "Account->Actor->Server" ON "Account->Actor"."serverId" = "Account->Actor->Server"."id" '

    this.builtAccountJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "VideoChannelCollaborators" ' +
      'ON "VideoChannelCollaborators"."channelId" = "VideoChannelModel"."id" ' +
      'AND "VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "VideoChannelCollaborators"."accountId" = :accountId '

    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED
    this.replacements.accountId = this.options.accountId

    this.builtChannelCollaboratorsJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildAccountAvatarsJoin () {
    if (this.builtAccountAvatarJoin) return

    this.join += `LEFT JOIN "actorImage" "Account->Actor->Avatars" ` +
      `ON "Account->Actor->Avatars"."actorId" = "VideoChannelModel"."Account.Actor.id" ` +
      `AND "Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR} `

    this.builtAccountAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += `LEFT JOIN "actorImage" "Actor->Avatars" ` +
      `ON "Actor->Avatars"."actorId" = "VideoChannelModel"."Actor.id" ` +
      `AND "Actor->Avatars"."type" = ${ActorImageType.AVATAR} `

    this.builtChannelAvatarJoin = true
  }

  private buildChannelBannersJoin () {
    if (this.builtChannelBannerJoin) return

    this.join += `LEFT JOIN "actorImage" "Actor->Banners" ` +
      `ON "Actor->Banners"."actorId" = "VideoChannelModel"."Actor.id" ` +
      `AND "Actor->Banners"."type" = ${ActorImageType.BANNER} `

    this.builtChannelBannerJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildChannelAvatarsJoin()
    this.buildAccountAvatarsJoin()
    this.buildChannelBannersJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getAccountAvatarAttributes(),
      this.tableAttributes.getChannelAvatarAttributes(),
      this.tableAttributes.getChannelBannerAttributes()
    ]

    if (this.options.statsDaysPrior) {
      this.attributes.push(
        `(SELECT COUNT(*) FROM "video" WHERE "channelId" = "VideoChannelModel"."id") AS "videosCount"`
      )

      this.attributes.push(
        // dprint-ignore
        '(' +
          `SELECT string_agg(concat_ws('|', t.day, t.views), ',') ` +
          'FROM ( ' +
            'WITH days AS ( ' +
              `SELECT generate_series(date_trunc('day', now()) - '${this.options.statsDaysPrior} day'::interval, ` +
                     `date_trunc('day', now()), '1 day'::interval) AS day ` +
            ') ' +
            'SELECT days.day AS day, COALESCE(SUM("videoView".views), 0) AS views ' +
            'FROM days ' +
            'LEFT JOIN (' +
              '"videoView" INNER JOIN "video" ON "videoView"."videoId" = "video"."id" ' +
              'AND "video"."channelId" = "VideoChannelModel"."id"' +
            `) ON date_trunc('day', "videoView"."startDate") = date_trunc('day', days.day) ` +
            'GROUP BY day ORDER BY day ' +
          ') t' +
        ') AS "viewsPerDay"'
      )

      this.attributes.push(
        '(' +
          'SELECT COALESCE(SUM("video".views), 0) AS totalViews ' +
          'FROM "video" ' +
          'WHERE "video"."channelId" = "VideoChannelModel"."id"' +
          ') AS "totalViews"'
      )
    }
  }

  protected buildSubQueryJoin () {
    this.buildActorJoin()
    this.buildAccountJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getVideoChannelAttributes(),

      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes(),

      this.tableAttributes.getAccountAttributes(),
      this.tableAttributes.getAccountActorAttributes(),
      this.tableAttributes.getAccountServerAttributes()
    ]
  }

  protected getCalculatedAttributes () {
    return [ 'similarity' ]
  }
}
