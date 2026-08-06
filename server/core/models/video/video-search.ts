import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { VideoModel } from '../video/video.js'

@Table({
  tableName: 'videoSearch',
  timestamps: false,
  indexes: [
    // Must be unique: the search vector trigger inserts with ON CONFLICT ("videoId")
    { fields: [ 'videoId' ], unique: true },
    { fields: [ 'searchVector' ], using: 'gin' }
  ]
})
export class VideoSearchModel extends SequelizeModel<VideoSearchModel> {
  @AllowNull(false)
  @Column(DataType.TSVECTOR)
  declare searchVector: string

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
}
