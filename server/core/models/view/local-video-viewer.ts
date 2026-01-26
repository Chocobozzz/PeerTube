import {
  VideoStatsOverall,
  VideoStatsRetention,
  VideoStatsTimeserie,
  VideoStatsTimeserieMetric,
  VideoStatsUserAgent,
  WatchActionObject
} from '@peertube/peertube-models'
import { MAX_SQL_DELETE_ITEMS } from '@server/initializers/constants.js'
import { getActivityStreamDuration } from '@server/lib/activitypub/activity.js'
import { buildGroupByAndBoundaries } from '@server/lib/timeserie.js'
import { MLocalVideoViewer, MLocalVideoViewerWithWatchSections, MVideo } from '@server/types/models/index.js'
import { Op, QueryOptionsWithType, QueryTypes } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, HasMany, IsUUID, Table } from 'sequelize-typescript'
import { safeBulkDestroy, SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'
import { LocalVideoViewerWatchSectionModel } from './local-video-viewer-watch-section.js'

/**
 * Aggregate viewers of local videos only to display statistics to video owners
 * A viewer is a user that watched one or multiple sections of a specific video inside a time window
 */

@Table({
  tableName: 'localVideoViewer',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class LocalVideoViewerModel extends SequelizeModel<LocalVideoViewerModel> {
  @CreatedAt
  declare createdAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare endDate: Date

  @AllowNull(false)
  @Column
  declare watchTime: number

  @AllowNull(true)
  @Column
  declare client: string

  @AllowNull(true)
  @Column
  declare device: string

  @AllowNull(true)
  @Column
  declare operatingSystem: string

  @AllowNull(true)
  @Column
  declare country: string

  @AllowNull(true)
  @Column
  declare subdivisionName: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  declare uuid: string

  @AllowNull(false)
  @Column
  declare url: string

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  @HasMany(() => LocalVideoViewerWatchSectionModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare WatchSections: Awaited<LocalVideoViewerWatchSectionModel>[]

  static loadByUrl (url: string): Promise<MLocalVideoViewer> {
    return this.findOne({
      where: {
        url
      }
    })
  }

  static loadFullById (id: number): Promise<MLocalVideoViewerWithWatchSections> {
    return this.findOne({
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        },
        {
          model: LocalVideoViewerWatchSectionModel.unscoped(),
          required: true
        }
      ],
      where: {
        id
      }
    })
  }

  static async getOverallStats (options: {
    video: MVideo
    startDate?: string
    endDate?: string
  }): Promise<VideoStatsOverall> {
    const { video, startDate, endDate } = options

    const queryOptions = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId: video.id } as any
    }

    if (startDate) queryOptions.replacements.startDate = startDate
    if (endDate) queryOptions.replacements.endDate = endDate

    const buildTotalViewersPromise = () => {
      let totalViewersDateWhere = ''

      if (startDate) totalViewersDateWhere += ' AND "localVideoViewer"."endDate" >= :startDate'
      if (endDate) totalViewersDateWhere += ' AND "localVideoViewer"."startDate" <= :endDate'

      const totalViewersQuery = `SELECT ` +
        `COUNT("localVideoViewer"."id") AS "totalViewers" ` +
        `FROM "localVideoViewer" ` +
        `WHERE "videoId" = :videoId ${totalViewersDateWhere}`

      return LocalVideoViewerModel.sequelize.query<any>(totalViewersQuery, queryOptions)
    }

    const buildWatchTimePromise = () => {
      let watchTimeDateWhere = ''

      // We know this where is not exact
      // But we prefer to take into account only watch section that started and ended **in** the interval
      if (startDate) watchTimeDateWhere += ' AND "localVideoViewer"."startDate" >= :startDate'
      if (endDate) watchTimeDateWhere += ' AND "localVideoViewer"."endDate" <= :endDate'

      const watchTimeQuery = `SELECT ` +
        `SUM("localVideoViewer"."watchTime") AS "totalWatchTime", ` +
        `AVG("localVideoViewer"."watchTime") AS "averageWatchTime" ` +
        `FROM "localVideoViewer" ` +
        `WHERE "videoId" = :videoId ${watchTimeDateWhere}`

      return LocalVideoViewerModel.sequelize.query<any>(watchTimeQuery, queryOptions)
    }

    const buildWatchPeakPromise = () => {
      let watchPeakDateWhereStart = ''
      let watchPeakDateWhereEnd = ''

      if (startDate) {
        watchPeakDateWhereStart += ' AND "localVideoViewer"."startDate" >= :startDate'
        watchPeakDateWhereEnd += ' AND "localVideoViewer"."endDate" >= :startDate'
      }

      if (endDate) {
        watchPeakDateWhereStart += ' AND "localVideoViewer"."startDate" <= :endDate'
        watchPeakDateWhereEnd += ' AND "localVideoViewer"."endDate" <= :endDate'
      }

      // Add viewers that were already here, before our start date
      const beforeWatchersQuery = startDate
        // eslint-disable-next-line max-len
        ? `SELECT COUNT(*) AS "total" FROM "localVideoViewer" WHERE "localVideoViewer"."startDate" < :startDate AND "localVideoViewer"."endDate" >= :startDate`
        : `SELECT 0 AS "total"`

      const watchPeakQuery = `WITH
        "beforeWatchers" AS (${beforeWatchersQuery}),
        "watchPeakValues" AS (
          SELECT "startDate" AS "dateBreakpoint", 1 AS "inc"
          FROM "localVideoViewer"
          WHERE "videoId" = :videoId ${watchPeakDateWhereStart}
          UNION ALL
          SELECT "endDate" AS "dateBreakpoint", -1 AS "inc"
          FROM "localVideoViewer"
          WHERE "videoId" = :videoId ${watchPeakDateWhereEnd}
        )
        SELECT "dateBreakpoint", "concurrent"
        FROM (
          SELECT "dateBreakpoint", SUM(SUM("inc")) OVER (ORDER BY "dateBreakpoint") + (SELECT "total" FROM "beforeWatchers") AS "concurrent"
          FROM "watchPeakValues"
          GROUP BY "dateBreakpoint"
        ) tmp
        ORDER BY "concurrent" DESC
        FETCH FIRST 1 ROW ONLY`

      return LocalVideoViewerModel.sequelize.query<any>(watchPeakQuery, queryOptions)
    }

    const [ rowsTotalViewers, rowsWatchTime, rowsWatchPeak, rowsCountries, rowsSubdivisions ] = await Promise.all([
      buildTotalViewersPromise(),
      buildWatchTimePromise(),
      buildWatchPeakPromise(),
      LocalVideoViewerModel.buildGroupBy({ groupByColumn: 'country', startDate, endDate, videoId: video.id }),
      LocalVideoViewerModel.buildGroupBy({ groupByColumn: 'subdivisionName', startDate, endDate, videoId: video.id })
    ])

    const viewersPeak = rowsWatchPeak.length !== 0
      ? parseInt(rowsWatchPeak[0].concurrent) || 0
      : 0

    return {
      totalWatchTime: rowsWatchTime.length !== 0
        ? Math.round(rowsWatchTime[0].totalWatchTime) || 0
        : 0,
      averageWatchTime: rowsWatchTime.length !== 0
        ? Math.round(rowsWatchTime[0].averageWatchTime) || 0
        : 0,

      totalViewers: rowsTotalViewers.length !== 0
        ? Math.round(rowsTotalViewers[0].totalViewers) || 0
        : 0,

      viewersPeak,
      viewersPeakDate: rowsWatchPeak.length !== 0 && viewersPeak !== 0
        ? rowsWatchPeak[0].dateBreakpoint || null
        : null,

      countries: rowsCountries.map(r => ({
        isoCode: r.country,
        viewers: r.viewers
      })),

      subdivisions: rowsSubdivisions.map(r => ({
        name: r.subdivisionName,
        viewers: r.viewers
      }))
    }
  }

  static async getUserAgentStats (options: {
    video: MVideo
    startDate?: string
    endDate?: string
  }): Promise<VideoStatsUserAgent> {
    const { video, startDate, endDate } = options

    const [ clients, devices, operatingSystems ] = await Promise.all([
      LocalVideoViewerModel.buildGroupBy({ groupByColumn: 'client', startDate, endDate, videoId: video.id }),
      LocalVideoViewerModel.buildGroupBy({ groupByColumn: 'device', startDate, endDate, videoId: video.id }),
      LocalVideoViewerModel.buildGroupBy({ groupByColumn: 'operatingSystem', startDate, endDate, videoId: video.id })
    ])

    return {
      clients: clients.map(r => ({
        name: r.client,
        viewers: r.viewers
      })),
      devices: devices.map(r => ({
        name: r.device,
        viewers: r.viewers
      })),
      operatingSystems: operatingSystems.map(r => ({
        name: r.operatingSystem,
        viewers: r.viewers
      }))
    }
  }

  static async getRetentionStats (video: MVideo): Promise<VideoStatsRetention> {
    const step = Math.max(Math.round(video.duration / 100), 1)

    const query = `WITH "total" AS (SELECT COUNT(*) AS viewers FROM "localVideoViewer" WHERE "videoId" = :videoId) ` +
      `SELECT serie AS "second", ` +
      `(COUNT("localVideoViewer".id)::float / (SELECT GREATEST("total"."viewers", 1) FROM "total")) AS "retention" ` +
      `FROM generate_series(0, ${video.duration}, ${step}) serie ` +
      `LEFT JOIN "localVideoViewer" ON "localVideoViewer"."videoId" = :videoId ` +
      `AND EXISTS (` +
      `SELECT 1 FROM "localVideoViewerWatchSection" ` +
      `WHERE "localVideoViewer"."id" = "localVideoViewerWatchSection"."localVideoViewerId" ` +
      `AND serie >= "localVideoViewerWatchSection"."watchStart" ` +
      `AND serie <= "localVideoViewerWatchSection"."watchEnd"` +
      `)` +
      `GROUP BY serie ` +
      `ORDER BY serie ASC`

    const queryOptions = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId: video.id }
    }

    const rows = await LocalVideoViewerModel.sequelize.query<any>(query, queryOptions)

    return {
      data: rows.map(r => ({
        second: r.second,
        retentionPercent: parseFloat(r.retention) * 100
      }))
    }
  }

  static async getTimeserieStats (options: {
    video: MVideo
    metric: VideoStatsTimeserieMetric
    startDate: string
    endDate: string
  }): Promise<VideoStatsTimeserie> {
    const { video, metric } = options

    const { groupInterval, startDate, endDate } = buildGroupByAndBoundaries(options.startDate, options.endDate)

    const selectMetrics: { [id in VideoStatsTimeserieMetric]: string } = {
      viewers: 'COUNT("localVideoViewer"."id")',
      aggregateWatchTime: 'SUM("localVideoViewer"."watchTime")'
    }

    const intervalWhere: { [id in VideoStatsTimeserieMetric]: string } = {
      // Viewer is still in the interval. Overlap algorithm
      viewers: '"localVideoViewer"."startDate" <= "intervals"."endDate" ' +
        'AND "localVideoViewer"."endDate" >= "intervals"."startDate"',

      // We do an aggregation, so only sum things once. Arbitrary we use the end date for that purpose
      aggregateWatchTime: '"localVideoViewer"."endDate" >= "intervals"."startDate" ' +
        'AND "localVideoViewer"."endDate" <= "intervals"."endDate"'
    }

    const query = `WITH "intervals" AS (
      SELECT
        "time" AS "startDate", "time" + :groupInterval::interval as "endDate"
      FROM
        generate_series(:startDate::timestamptz, :endDate::timestamptz, :groupInterval::interval) serie("time")
    )
    SELECT "intervals"."startDate" as "date", COALESCE(${selectMetrics[metric]}, 0) AS value
    FROM
      intervals
      LEFT JOIN "localVideoViewer" ON "localVideoViewer"."videoId" = :videoId
        AND ${intervalWhere[metric]}
    GROUP BY
      "intervals"."startDate"
    ORDER BY
      "intervals"."startDate"`

    const queryOptions = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
        groupInterval,
        videoId: video.id
      }
    }

    const rows = await LocalVideoViewerModel.sequelize.query<any>(query, queryOptions)

    return {
      groupInterval,
      data: rows.map(r => ({
        date: r.date,
        value: parseInt(r.value)
      }))
    }
  }

  private static async buildGroupBy (options: {
    groupByColumn: 'country' | 'subdivisionName' | 'client' | 'device' | 'operatingSystem'
    startDate?: string
    endDate?: string
    videoId: number
  }) {
    const { groupByColumn, startDate, endDate, videoId } = options

    const queryOptions: QueryOptionsWithType<QueryTypes.SELECT> = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId, startDate, endDate }
    }

    let dateWhere = ''

    if (startDate) dateWhere += ' AND "localVideoViewer"."endDate" >= :startDate'
    if (endDate) dateWhere += ' AND "localVideoViewer"."startDate" <= :endDate'

    const query = `SELECT "${groupByColumn}", COUNT("${groupByColumn}") as viewers ` +
      `FROM "localVideoViewer" ` +
      `WHERE "videoId" = :videoId AND "${groupByColumn}" IS NOT NULL ${dateWhere} ` +
      `GROUP BY "${groupByColumn}" ` +
      `ORDER BY "viewers" DESC`

    return LocalVideoViewerModel.sequelize.query<any>(query, queryOptions)
  }

  toActivityPubObject (this: MLocalVideoViewerWithWatchSections): WatchActionObject {
    const location = this.country
      ? {
        location: {
          addressCountry: this.country,
          addressRegion: this.subdivisionName
        }
      }
      : {}

    return {
      id: this.url,
      type: 'WatchAction',
      duration: getActivityStreamDuration(this.watchTime),
      startTime: this.startDate.toISOString(),
      endTime: this.endDate.toISOString(),

      object: this.Video.url,
      uuid: this.uuid,
      actionStatus: 'CompletedActionStatus',

      watchSections: this.WatchSections.map(w => ({
        startTimestamp: w.watchStart,
        endTimestamp: w.watchEnd
      })),

      ...location
    }
  }

  // ---------------------------------------------------------------------------

  static removeOldViews (beforeDate: string) {
    return safeBulkDestroy(() => {
      return LocalVideoViewerModel.destroy({
        where: {
          startDate: {
            [Op.lt]: beforeDate
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }
}
