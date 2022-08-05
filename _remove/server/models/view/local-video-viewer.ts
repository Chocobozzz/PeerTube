import { QueryTypes } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, HasMany, IsUUID, Model, Table } from 'sequelize-typescript'
import { getActivityStreamDuration } from '@server/lib/activitypub/activity'
import { buildGroupByAndBoundaries } from '@server/lib/timeserie'
import { MLocalVideoViewer, MLocalVideoViewerWithWatchSections, MVideo } from '@server/types/models'
import { VideoStatsOverall, VideoStatsRetention, VideoStatsTimeserie, VideoStatsTimeserieMetric, WatchActionObject } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from '../video/video'
import { LocalVideoViewerWatchSectionModel } from './local-video-viewer-watch-section'

/**
 *
 * Aggregate viewers of local videos only to display statistics to video owners
 * A viewer is a user that watched one or multiple sections of a specific video inside a time window
 *
 */

@Table({
  tableName: 'localVideoViewer',
  updatedAt: false,
  indexes: [
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class LocalVideoViewerModel extends Model<Partial<AttributesOnly<LocalVideoViewerModel>>> {
  @CreatedAt
  createdAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  endDate: Date

  @AllowNull(false)
  @Column
  watchTime: number

  @AllowNull(true)
  @Column
  country: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Column
  url: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @HasMany(() => LocalVideoViewerWatchSectionModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  WatchSections: LocalVideoViewerWatchSectionModel[]

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

    let dateWhere = ''

    if (startDate) {
      dateWhere += ' AND "localVideoViewer"."startDate" >= :startDate'
      queryOptions.replacements.startDate = startDate
    }

    if (endDate) {
      dateWhere += ' AND "localVideoViewer"."endDate" <= :endDate'
      queryOptions.replacements.endDate = endDate
    }

    const watchTimeQuery = `SELECT ` +
      `COUNT("localVideoViewer"."id") AS "totalViewers", ` +
      `SUM("localVideoViewer"."watchTime") AS "totalWatchTime", ` +
      `AVG("localVideoViewer"."watchTime") AS "averageWatchTime" ` +
      `FROM "localVideoViewer" ` +
      `INNER JOIN "video" ON "video"."id" = "localVideoViewer"."videoId" ` +
      `WHERE "videoId" = :videoId ${dateWhere}`

    const watchTimePromise = LocalVideoViewerModel.sequelize.query<any>(watchTimeQuery, queryOptions)

    const watchPeakQuery = `WITH "watchPeakValues" AS (
        SELECT "startDate" AS "dateBreakpoint", 1 AS "inc"
        FROM "localVideoViewer"
        WHERE "videoId" = :videoId ${dateWhere}
        UNION ALL
        SELECT "endDate" AS "dateBreakpoint", -1 AS "inc"
        FROM "localVideoViewer"
        WHERE "videoId" = :videoId ${dateWhere}
      )
      SELECT "dateBreakpoint", "concurrent"
      FROM (
        SELECT "dateBreakpoint", SUM(SUM("inc")) OVER (ORDER BY "dateBreakpoint") AS "concurrent"
        FROM "watchPeakValues"
        GROUP BY "dateBreakpoint"
      ) tmp
      ORDER BY "concurrent" DESC
      FETCH FIRST 1 ROW ONLY`
    const watchPeakPromise = LocalVideoViewerModel.sequelize.query<any>(watchPeakQuery, queryOptions)

    const countriesQuery = `SELECT country, COUNT(country) as viewers ` +
      `FROM "localVideoViewer" ` +
      `WHERE "videoId" = :videoId AND country IS NOT NULL ${dateWhere} ` +
      `GROUP BY country ` +
      `ORDER BY viewers DESC`
    const countriesPromise = LocalVideoViewerModel.sequelize.query<any>(countriesQuery, queryOptions)

    const [ rowsWatchTime, rowsWatchPeak, rowsCountries ] = await Promise.all([
      watchTimePromise,
      watchPeakPromise,
      countriesPromise
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

      totalViewers: rowsWatchTime.length !== 0
        ? Math.round(rowsWatchTime[0].totalViewers) || 0
        : 0,

      viewersPeak,
      viewersPeakDate: rowsWatchPeak.length !== 0 && viewersPeak !== 0
        ? rowsWatchPeak[0].dateBreakpoint || null
        : null,

      countries: rowsCountries.map(r => ({
        isoCode: r.country,
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

    const selectMetrics: { [ id in VideoStatsTimeserieMetric ]: string } = {
      viewers: 'COUNT("localVideoViewer"."id")',
      aggregateWatchTime: 'SUM("localVideoViewer"."watchTime")'
    }

    const intervalWhere: { [ id in VideoStatsTimeserieMetric ]: string } = {
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

  toActivityPubObject (this: MLocalVideoViewerWithWatchSections): WatchActionObject {
    const location = this.country
      ? {
        location: {
          addressCountry: this.country
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
}
