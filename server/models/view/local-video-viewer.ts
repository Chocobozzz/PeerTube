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

  static async getOverallStats (video: MVideo): Promise<VideoStatsOverall> {
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId: video.id }
    }

    const watchTimeQuery = `SELECT ` +
      `SUM("localVideoViewer"."watchTime") AS "totalWatchTime", ` +
      `AVG("localVideoViewer"."watchTime") AS "averageWatchTime" ` +
      `FROM "localVideoViewer" ` +
      `INNER JOIN "video" ON "video"."id" = "localVideoViewer"."videoId" ` +
      `WHERE "videoId" = :videoId`

    const watchTimePromise = LocalVideoViewerModel.sequelize.query<any>(watchTimeQuery, options)

    const watchPeakQuery = `WITH "watchPeakValues" AS (
        SELECT "startDate" AS "dateBreakpoint", 1 AS "inc"
        FROM "localVideoViewer"
        WHERE "videoId" = :videoId
        UNION ALL
        SELECT "endDate" AS "dateBreakpoint", -1 AS "inc"
        FROM "localVideoViewer"
        WHERE "videoId" = :videoId
      )
      SELECT "dateBreakpoint", "concurrent"
      FROM (
        SELECT "dateBreakpoint", SUM(SUM("inc")) OVER (ORDER BY "dateBreakpoint") AS "concurrent"
        FROM "watchPeakValues"
        GROUP BY "dateBreakpoint"
      ) tmp
      ORDER BY "concurrent" DESC
      FETCH FIRST 1 ROW ONLY`
    const watchPeakPromise = LocalVideoViewerModel.sequelize.query<any>(watchPeakQuery, options)

    const commentsQuery = `SELECT COUNT(*) AS comments FROM "videoComment" WHERE "videoId" = :videoId`
    const commentsPromise = LocalVideoViewerModel.sequelize.query<any>(commentsQuery, options)

    const countriesQuery = `SELECT country, COUNT(country) as viewers ` +
      `FROM "localVideoViewer" ` +
      `WHERE "videoId" = :videoId AND country IS NOT NULL ` +
      `GROUP BY country ` +
      `ORDER BY viewers DESC`
    const countriesPromise = LocalVideoViewerModel.sequelize.query<any>(countriesQuery, options)

    const [ rowsWatchTime, rowsWatchPeak, rowsComment, rowsCountries ] = await Promise.all([
      watchTimePromise,
      watchPeakPromise,
      commentsPromise,
      countriesPromise
    ])

    return {
      totalWatchTime: rowsWatchTime.length !== 0
        ? Math.round(rowsWatchTime[0].totalWatchTime) || 0
        : 0,
      averageWatchTime: rowsWatchTime.length !== 0
        ? Math.round(rowsWatchTime[0].averageWatchTime) || 0
        : 0,

      viewersPeak: rowsWatchPeak.length !== 0
        ? parseInt(rowsWatchPeak[0].concurrent) || 0
        : 0,
      viewersPeakDate: rowsWatchPeak.length !== 0
        ? rowsWatchPeak[0].dateBreakpoint || null
        : null,

      views: video.views,
      likes: video.likes,
      dislikes: video.dislikes,

      comments: rowsComment.length !== 0
        ? parseInt(rowsComment[0].comments) || 0
        : 0,

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

    const { groupInterval, sqlInterval, startDate, endDate } = buildGroupByAndBoundaries(options.startDate, options.endDate)

    const selectMetrics: { [ id in VideoStatsTimeserieMetric ]: string } = {
      viewers: 'COUNT("localVideoViewer"."id")',
      aggregateWatchTime: 'SUM("localVideoViewer"."watchTime")'
    }

    const query = `WITH "intervals" AS (
      SELECT
        "time" AS "startDate", "time" + :sqlInterval::interval as "endDate"
      FROM
        generate_series(:startDate::timestamptz, :endDate::timestamptz, :sqlInterval::interval) serie("time")
    )
    SELECT "intervals"."startDate" as "date", COALESCE(${selectMetrics[metric]}, 0) AS value
    FROM
      intervals
      LEFT JOIN "localVideoViewer" ON "localVideoViewer"."videoId" = :videoId
        AND "localVideoViewer"."startDate" >= "intervals"."startDate" AND "localVideoViewer"."startDate" <= "intervals"."endDate"
    GROUP BY
      "intervals"."startDate"
    ORDER BY
      "intervals"."startDate"`

    const queryOptions = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
        sqlInterval,
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
