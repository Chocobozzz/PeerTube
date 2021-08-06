import { AttributesOnly } from "@shared/core-utils"
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  IsInt,
  Model,
  Table,
  Unique,
  UpdatedAt
} from "sequelize-typescript"
import { Op, QueryTypes } from "sequelize"
import { VideoModel } from "./video"

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

  static async increaseOrCreatePendingMove (videoUUID: string): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{pendingMove: number}>(`
    INSERT INTO "videoJobInfo" ("videoId", "pendingMove", "createdAt", "updatedAt")
    SELECT
      "video"."id" AS "videoId", 1, NOW(), NOW()
    FROM
      "video"
    WHERE
      "video"."uuid" = $videoUUID
    ON CONFLICT ("videoId") DO UPDATE
    SET
      "pendingMove" = "videoJobInfo"."pendingMove" + 1,
      "updatedAt" = NOW()
    RETURNING
      "pendingMove"
    `, options)

    return pendingMove
  }

  static async decreasePendingMove (videoUUID: string): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{pendingMove: number}>(`
    UPDATE
      "videoJobInfo"
    SET
      "pendingMove" = "videoJobInfo"."pendingMove" - 1,
      "updatedAt" = NOW()
    FROM "video"
    WHERE
      "video"."id" = "videoJobInfo"."videoId" AND "video"."uuid" = $videoUUID
    RETURNING
      "pendingMove";
    `, options)

    return pendingMove
  }
}
