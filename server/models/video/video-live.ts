import { AllowNull, BelongsTo, Column, CreatedAt, DataType, DefaultScope, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { WEBSERVER } from '@server/initializers/constants'
import { MVideoLive, MVideoLiveVideo } from '@server/types/models'
import { LiveVideo, VideoState } from '@shared/models'
import { VideoModel } from './video'
import { VideoBlacklistModel } from './video-blacklist'

@DefaultScope(() => ({
  include: [
    {
      model: VideoModel,
      required: true,
      include: [
        {
          model: VideoBlacklistModel,
          required: false
        }
      ]
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
export class VideoLiveModel extends Model {

  @AllowNull(true)
  @Column(DataType.STRING)
  streamKey: string

  @AllowNull(false)
  @Column
  saveReplay: boolean

  @AllowNull(false)
  @Column
  permanentLive: boolean

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
      },
      include: [
        {
          model: VideoModel.unscoped(),
          required: true,
          where: {
            state: VideoState.WAITING_FOR_LIVE
          },
          include: [
            {
              model: VideoBlacklistModel.unscoped(),
              required: false
            }
          ]
        }
      ]
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

  toFormattedJSON (): LiveVideo {
    return {
      // If we don't have a stream key, it means this is a remote live so we don't specify the rtmp URL
      rtmpUrl: this.streamKey
        ? WEBSERVER.RTMP_URL
        : null,

      streamKey: this.streamKey,
      permanentLive: this.permanentLive,
      saveReplay: this.saveReplay
    }
  }
}
