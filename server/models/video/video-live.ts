import { AllowNull, BelongsTo, Column, CreatedAt, DataType, DefaultScope, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { WEBSERVER } from '@server/initializers/constants'
import { MVideoLive, MVideoLiveVideo } from '@server/types/models'
import { VideoLive } from '@shared/models/videos/video-live.model'
import { VideoModel } from './video'

@DefaultScope(() => ({
  include: [
    {
      model: VideoModel,
      required: true
    }
  ]
}))
@Table({
  tableName: 'videoLive',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    }
  ]
})
export class VideoLiveModel extends Model<VideoLiveModel> {

  @AllowNull(false)
  @Column(DataType.STRING)
  streamKey: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  static loadByStreamKey (streamKey: string) {
    const query = {
      where: {
        streamKey
      }
    }

    return VideoLiveModel.findOne<MVideoLiveVideo>(query)
  }

  static loadByVideoId (videoId: number) {
    const query = {
      where: {
        videoId
      }
    }

    return VideoLiveModel.findOne<MVideoLive>(query)
  }

  toFormattedJSON (): VideoLive {
    return {
      rtmpUrl: WEBSERVER.RTMP_URL,
      streamKey: this.streamKey
    }
  }
}
