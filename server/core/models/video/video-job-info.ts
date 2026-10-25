import { forceNumber } from '@peertube/peertube-core-utils'
import { Op, QueryTypes, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, IsInt, Table, Unique, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/sequelize-type.js'
import { VideoModel } from './video.js'

export type VideoJobInfoColumnType = 'pendingMove' | 'pendingTranscode' | 'pendingTranscription'

@Table({
  tableName: 'videoJobInfo',
  indexes: [
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    }
  ]
})
export class VideoJobInfoModel extends SequelizeModel<VideoJobInfoModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  declare pendingMove: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  declare pendingTranscode: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  declare pendingTranscription: number

  @ForeignKey(() => VideoModel)
  @Unique
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  static load (videoId: number, transaction?: Transaction) {
    const where = {
      videoId
    }

    return VideoJobInfoModel.findOne({ where, transaction })
  }

  static async increaseOrCreate (videoUUID: string, column: VideoJobInfoColumnType, amountArg = 1): Promise<number> {
    // Not a SELECT query type, so it is not sent to a database read replica
    const options = { type: QueryTypes.RAW as QueryTypes.RAW, bind: { videoUUID } }
    const amount = forceNumber(amountArg)

    const [ rows ] = await VideoJobInfoModel.sequelize.query(
      `
    INSERT INTO "videoJobInfo" ("videoId", "${column}", "createdAt", "updatedAt")
    SELECT
      "video"."id" AS "videoId", ${amount}, NOW(), NOW()
    FROM
      "video"
    WHERE
      "video"."uuid" = $videoUUID
    ON CONFLICT ("videoId") DO UPDATE
    SET
      "${column}" = "videoJobInfo"."${column}" + ${amount},
      "updatedAt" = NOW()
    RETURNING
      "${column}"
    `,
      options
    )

    return (rows as Record<string, number>[])[0][column]
  }

  static async decrease (videoUUID: string, column: VideoJobInfoColumnType): Promise<number> {
    const options = { type: QueryTypes.RAW as QueryTypes.RAW, bind: { videoUUID } }

    const [ rows ] = await VideoJobInfoModel.sequelize.query(
      `
    UPDATE
      "videoJobInfo"
    SET
      "${column}" = GREATEST("videoJobInfo"."${column}" - 1, 0),
      "updatedAt" = NOW()
    FROM "video"
    WHERE
      "video"."id" = "videoJobInfo"."videoId" AND "video"."uuid" = $videoUUID
    RETURNING
      "${column}";
    `,
      options
    )

    const result = rows as Record<string, number>[]
    if (result.length === 0) return undefined

    return result[0][column]
  }

  static async abortAllTasks (videoUUID: string, column: VideoJobInfoColumnType): Promise<void> {
    const options = { type: QueryTypes.UPDATE as QueryTypes.UPDATE, bind: { videoUUID } }

    await VideoJobInfoModel.sequelize.query(
      `
    UPDATE
      "videoJobInfo"
    SET
      "${column}" = 0,
      "updatedAt" = NOW()
    FROM "video"
    WHERE
      "video"."id" = "videoJobInfo"."videoId" AND "video"."uuid" = $videoUUID
    `,
      options
    )
  }
}
