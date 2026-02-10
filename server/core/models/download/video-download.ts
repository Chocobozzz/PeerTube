import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Table, } from "sequelize-typescript"
import { VideoModel } from "../video/video.js"
import { SequelizeModel } from "../shared/sequelize-type.js"
import { MVideo } from "@server/types/models/index.js"
import { VideoDownloadStatsTimeserieMetric, VideoStatsTimeserie } from "@peertube/peertube-models"
import { buildGroupByAndBoundaries } from "@server/lib/timeserie.js"
import { QueryTypes } from "sequelize"

@Table({
  tableName: "videoDownload",
  createdAt: false,
  updatedAt: false,
  indexes: [ {
      fields: [ "videoId" ],
    },
    {
      fields: [ "startDate" ],
    },
  ],
})
export class VideoDownloadModel extends SequelizeModel < VideoDownloadModel > {
  @AllowNull(false)
  @Column(DataType.DATE)
  declare startDate: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  declare endDate: Date

  @AllowNull(false)
  @Column
  declare downloads: number

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false,
    },
    onDelete: "CASCADE",
  })
  declare Video: Awaited < VideoModel > 

  static async getTimeserieStats (options: {
    video: MVideo
    metric: VideoDownloadStatsTimeserieMetric
    startDate: string
    endDate: string
  }): Promise<VideoStatsTimeserie> {
    const { video } = options

    const { groupInterval, startDate, endDate } = buildGroupByAndBoundaries(options.startDate, options.endDate)

    const query = `WITH "intervals" AS (
      SELECT
        "time" AS "startDate", "time" + :groupInterval::interval as "endDate"
      FROM
        generate_series(:startDate::timestamptz, :endDate::timestamptz, :groupInterval::interval) serie("time")
    )
    SELECT
      "intervals"."startDate" AS date, COALESCE("videoDownload"."downloads", 0) AS value
    FROM
      "intervals"
      LEFT JOIN "videoDownload" ON "videoDownload"."videoId" = :videoId
        AND
          "videoDownload"."startDate" <= "intervals"."endDate"
        AND
          "videoDownload"."endDate" >= "intervals"."startDate"
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

    const rows = await VideoDownloadModel.sequelize.query<any>(query, queryOptions)

    return {
      groupInterval,
      data: rows.map(r => ({
        date: r.date,
        value: parseInt(r.value)
      }))
    }
  }
}
