import { Op, QueryTypes, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, IsInt, Model, Table, Unique, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from './video'

export type VideoJobInfoColumnType = 'pendingMove' | 'pendingTranscode'

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

export class VideoJobInfoModel extends Model<Partial<AttributesOnly<VideoJobInfoModel>>> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  pendingMove: number

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  pendingTranscode: number

  @ForeignKey(() => VideoModel)
  @Unique
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  static load (videoId: number, transaction?: Transaction) {
    const where = {
      videoId
    }

    return VideoJobInfoModel.findOne({ where, transaction })
  }

  static async increaseOrCreate (videoUUID: string, column: VideoJobInfoColumnType): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{ pendingMove: number }>(`
    INSERT INTO "videoJobInfo" ("videoId", "${column}", "createdAt", "updatedAt")
    SELECT
      "video"."id" AS "videoId", 1, NOW(), NOW()
    FROM
      "video"
    WHERE
      "video"."uuid" = $videoUUID
    ON CONFLICT ("videoId") DO UPDATE
    SET
      "${column}" = "videoJobInfo"."${column}" + 1,
      "updatedAt" = NOW()
    RETURNING
      "${column}"
    `, options)

    return pendingMove
  }

  static async decrease (videoUUID: string, column: VideoJobInfoColumnType): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{ pendingMove: number }>(`
    UPDATE
      "videoJobInfo"
    SET
      "${column}" = "videoJobInfo"."${column}" - 1,
      "updatedAt" = NOW()
    FROM "video"
    WHERE
      "video"."id" = "videoJobInfo"."videoId" AND "video"."uuid" = $videoUUID
    RETURNING
      "${column}";
    `, options)

    return pendingMove
  }

  static async abortAllTasks (videoUUID: string, column: VideoJobInfoColumnType): Promise<void> {
    const options = { type: QueryTypes.UPDATE as QueryTypes.UPDATE, bind: { videoUUID } }

    await VideoJobInfoModel.sequelize.query(`
    UPDATE
      "videoJobInfo"
    SET
      "${column}" = 0,
      "updatedAt" = NOW()
    FROM "video"
    WHERE
      "video"."id" = "videoJobInfo"."videoId" AND "video"."uuid" = $videoUUID
    `, options)
  }
}
