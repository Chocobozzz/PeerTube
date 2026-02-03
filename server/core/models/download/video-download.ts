import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Table, } from "sequelize-typescript";
import { VideoModel } from "../video/video.js";
import { SequelizeModel } from "../shared/sequelize-type.js";

@Table({
  tableName: "videoDownload",
  createdAt: false,
  updatedAt: false,
  indexes: [{
      fields: ["videoId"],
    },
    {
      fields: ["startDate"],
    },
  ],
})
export class VideoDownloadModel extends SequelizeModel < VideoDownloadModel > {
  @AllowNull(false)
  @Column(DataType.DATE)
  declare startDate: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare endDate: Date;

  @AllowNull(false)
  @Column
  declare downloads: number

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number;

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false,
    },
    onDelete: "CASCADE",
  })
  declare Video: Awaited < VideoModel > ;
}
