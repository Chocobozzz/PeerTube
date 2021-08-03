import { AttributesOnly } from "@shared/core-utils"
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsInt,
  IsUUID,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript"
import { Op, QueryTypes } from "sequelize"
import { VideoModel } from "./video"

@Table({
  tableName: 'videoJobInfo',
  indexes: [
    {
      fields: [ 'videoUUID' ],
      where: {
        videoUUID: {
          [Op.ne]: null
        }
      },
      unique: true
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
  @IsUUID(4)
  @Column(DataType.UUID)
  videoUUID: string

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    targetKey: 'uuid',
    onDelete: 'cascade'
  })
  Video: VideoModel

  static async increaseOrCreatePendingMove (videoUUID: string): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{pendingMove: number}>(`
    INSERT INTO "videoJobInfo" ("videoUUID", "pendingMove", "createdAt", "updatedAt") 
    VALUES ($videoUUID, 1, NOW(), NOW()) 
    ON CONFLICT ("videoUUID") WHERE "videoUUID" = $videoUUID 
    DO UPDATE SET "pendingMove" = "videoJobInfo"."pendingMove" + 1, "updatedAt" = NOW() 
    RETURNING "pendingMove"
    `, options)

    return pendingMove
  }

  static async decreasePendingMove (videoUUID: string): Promise<number> {
    const options = { type: QueryTypes.SELECT as QueryTypes.SELECT, bind: { videoUUID } }

    const [ { pendingMove } ] = await VideoJobInfoModel.sequelize.query<{pendingMove: number}>(`
    UPDATE "videoJobInfo" SET "pendingMove" = "videoJobInfo"."pendingMove" - 1, "updatedAt" = NOW() 
    RETURNING "pendingMove"
    `, options)

    return pendingMove
  }
}
