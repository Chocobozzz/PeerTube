import {
  ActorImageType,
  VIDEO_CHANNEL_STATS_DAYS_ALL_TIME,
  VIDEO_CHANNEL_STATS_MONTH_GROUP_THRESHOLD_DAYS,
  VIDEO_CHANNEL_STATS_WEEK_GROUP_THRESHOLD_DAYS,
  VideoChannelCollaboratorState
} from '@peertube/peertube-models'
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
  private builtChannelStatsJoin = false

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

  private buildChannelStatsJoin () {
    if (this.builtChannelStatsJoin) return

    // On a bounded range, every channel of the page shares the same x axis and the same bucket size and can be compared to the others
    // "All time" has no boundary: it starts at the first recorded stat of the channel (a young channel keeps a fine bucket size)
    const seriesCTE = this.options.statsDaysPrior === VIDEO_CHANNEL_STATS_DAYS_ALL_TIME
      // dprint-ignore
      ? 'series AS ( ' +
          'SELECT COALESCE(date_trunc(\'day\', MIN("videoStat"."startDate")), date_trunc(\'day\', now())) AS start_date ' +
          'FROM "videoStat" INNER JOIN "video" ON "videoStat"."videoId" = "video"."id" ' +
          'WHERE "video"."channelId" = "VideoChannelModel"."id"' +
        ')'
      : 'series AS ( ' +
        `SELECT date_trunc('day', now()) - make_interval(days => :statsDaysPrior) AS start_date` +
        ')'

    if (this.options.statsDaysPrior !== VIDEO_CHANNEL_STATS_DAYS_ALL_TIME) {
      this.replacements.statsDaysPrior = this.options.statsDaysPrior
    }

    this.replacements.statsMonthGroupThresholdDays = VIDEO_CHANNEL_STATS_MONTH_GROUP_THRESHOLD_DAYS
    this.replacements.statsWeekGroupThresholdDays = VIDEO_CHANNEL_STATS_WEEK_GROUP_THRESHOLD_DAYS

    // Computed once per channel row (instead of once per selected attribute) and shared by
    // viewsPerDay/viewsGroupInterval below via the CTEs
    this.join +=
      // dprint-ignore
      'LEFT JOIN LATERAL ( ' +
        `WITH ${seriesCTE}, ` +
        'series_group AS ( ' +
          // Keep in sync with getVideoChannelStatsGroupInterval, which mirrors this for the client fallback
          'SELECT start_date, ' +
            'CASE ' +
              'WHEN EXTRACT(EPOCH FROM (date_trunc(\'day\', now()) - start_date)) / 86400.0 > :statsMonthGroupThresholdDays THEN \'month\' ' +
              'WHEN EXTRACT(EPOCH FROM (date_trunc(\'day\', now()) - start_date)) / 86400.0 >= :statsWeekGroupThresholdDays THEN \'week\' ' +
              'ELSE \'day\' ' +
            'END AS grp ' +
          'FROM series' +
        '), periods AS ( ' +
          'SELECT gs.day AS day, series_group.grp AS grp, series_group.start_date AS start_date ' +
          'FROM series_group, ' +
          'LATERAL generate_series( ' +
            'date_trunc(series_group.grp, series_group.start_date), ' +
            'date_trunc(series_group.grp, now()), ' +
            'CASE series_group.grp ' +
              'WHEN \'day\' THEN interval \'1 day\' ' +
              'WHEN \'week\' THEN interval \'1 week\' ' +
              'ELSE interval \'1 month\' ' +
            'END' +
          ') AS gs(day) ' +
        ') ' +
        'SELECT ' +
          '(' +
            `SELECT string_agg(concat_ws('|', t.day, t.views), ',') ` +
            'FROM ( ' +
              'SELECT periods.day AS day, COALESCE(SUM("videoStat".views), 0) AS views ' +
              'FROM periods ' +
              'LEFT JOIN (' +
                '"videoStat" INNER JOIN "video" ON "videoStat"."videoId" = "video"."id" ' +
                'AND "video"."channelId" = "VideoChannelModel"."id"' +
              ') ON date_trunc(periods.grp, "videoStat"."startDate") = periods.day ' +
                // The first (week/month) bucket floor can precede the range start, so without this
                // the first bar would also count views that happened before the requested range
                'AND "videoStat"."startDate" >= periods.start_date ' +
              'GROUP BY day ORDER BY day ' +
            ') t' +
          ') AS "viewsPerDay", ' +
          '(SELECT grp FROM series_group) AS "viewsGroupInterval"' +
      ') AS "ChannelStats" ON TRUE '

    this.builtChannelStatsJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildChannelAvatarsJoin()
    this.buildAccountAvatarsJoin()
    this.buildChannelBannersJoin()

    if (this.options.statsDaysPrior !== undefined) {
      this.buildChannelStatsJoin()
    }
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getAccountAvatarAttributes(),
      this.tableAttributes.getChannelAvatarAttributes(),
      this.tableAttributes.getChannelBannerAttributes()
    ]

    if (this.options.statsDaysPrior !== undefined) {
      this.attributes.push(
        `(SELECT COUNT(*) FROM "video" WHERE "channelId" = "VideoChannelModel"."id") AS "videosCount"`,
        '"ChannelStats"."viewsPerDay" AS "viewsPerDay"',
        '"ChannelStats"."viewsGroupInterval" AS "viewsGroupInterval"',
        // Lifetime views: unlike viewsPerDay it is not bound to statsDaysPrior, and it uses the video
        // view counter so it also includes federated views and views older than the "videoStat" retention
        '(' +
          'SELECT COALESCE(SUM("video".views), 0) ' +
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
