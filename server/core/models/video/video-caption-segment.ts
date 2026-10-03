import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { VideoModel } from './video.js'
import { VideoCaptionModel } from './video-caption.js'

@Table({
  tableName: 'videoCaptionSegment',
  timestamps: false,
  indexes: [
    { fields: [ 'videoId' ] },
    { fields: [ 'captionId' ] },
    { fields: [ 'searchVector' ], using: 'gin' }
  ]
})
export class VideoCaptionSegmentModel extends SequelizeModel<VideoCaptionSegmentModel> {
  @AllowNull(false)
  @Column(DataType.TSVECTOR)
  declare searchVector: string

  @AllowNull(false)
  @Column
  declare language: string

  @AllowNull(false)
  @Column
  declare automaticallyGenerated: boolean

  @AllowNull(false)
  @Column
  declare startMs: number

  @AllowNull(false)
  @Column
  declare endMs: number

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare text: string

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

  @ForeignKey(() => VideoCaptionModel)
  @Column
  declare captionId: number

  @BelongsTo(() => VideoCaptionModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare VideoCaption: Awaited<VideoCaptionModel>
}
