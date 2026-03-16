import { VideoStatsTimeserie } from '@peertube/peertube-models'
import { MAX_SQL_DELETE_ITEMS } from '@server/initializers/constants.js'
import { buildGroupByAndBoundaries } from '@server/lib/timeserie.js'
import { MVideo } from '@server/types/models/index.js'
import { literal, Op, QueryTypes } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Table } from 'sequelize-typescript'
import { safeBulkDestroy, SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'

/**
 * Aggregate stats of all videos federated with our instance
 * Mainly used by the trending/hot algorithms
 */

@Table({
  tableName: 'videoStat',
  updatedAt: false,
  indexes: [ {
    fields: [ 'videoId' ]
  }, {
    fields: [ 'startDate' ]
  } ]
})
export class VideoStatModel extends SequelizeModel<VideoStatModel> {
  @CreatedAt
  declare createdAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare endDate: Date

  @AllowNull(false)
  @Default(0)
  @Column
  declare views: number

  @AllowNull(false)
  @Default(0)
  @Column
  declare downloads: number

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

  static removeOldRemoteStats (beforeDate: string) {
    return safeBulkDestroy(() => {
      return VideoStatModel.destroy({
        where: {
          startDate: {
            [Op.lt]: beforeDate
          },
          videoId: {
            [Op.in]: literal(
              '(SELECT "id" FROM "video" WHERE "remote" IS TRUE)'
            )
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }

  static removeOldLocalStats (beforeDate: string) {
    return safeBulkDestroy(() => {
      return VideoStatModel.destroy({
        where: {
          startDate: {
            [Op.lt]: beforeDate
          },
          videoId: {
            [Op.in]: literal(
              '(SELECT "id" FROM "video" WHERE "remote" IS FALSE)'
            )
          }
        },
        limit: MAX_SQL_DELETE_ITEMS
      })
    })
  }

  static async getDownloadTimeserieStats (options: {
    video: MVideo
    startDate: string
    endDate: string
  }): Promise<VideoStatsTimeserie> {
    const { video } = options

    const { groupInterval, startDate, endDate } = buildGroupByAndBoundaries(
      options.startDate,
      options.endDate
    )

    const query = `WITH "intervals" AS (
      SELECT
        "time" AS "startDate", "time" + :groupInterval::interval as "endDate"
      FROM
        generate_series(:startDate::timestamptz, :endDate::timestamptz, :groupInterval::interval) serie("time")
    )
    SELECT
      "intervals"."startDate" AS date, COALESCE("videoStat"."downloads", 0) AS value
    FROM
      "intervals"
      LEFT JOIN "videoStat" ON "videoStat"."videoId" = :videoId
        AND
          "videoStat"."startDate" <= "intervals"."endDate"
        AND
          "videoStat"."startDate" >= "intervals"."startDate"
    ORDER BY
      "intervals"."startDate"
    `

    const queryOptions = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
        groupInterval,
        videoId: video.id
      }
    }

    const rows = await VideoStatModel.sequelize.query<any>(
      query,
      queryOptions
    )

    return {
      groupInterval,
      data: rows.map(r => ({
        date: r.date,
        value: parseInt(r.value)
      }))
    }
  }
}
