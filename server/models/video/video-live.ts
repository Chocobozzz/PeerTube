import { Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  DefaultScope,
  ForeignKey,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { CONFIG } from '@server/initializers/config'
import { WEBSERVER } from '@server/initializers/constants'
import { MVideoLive, MVideoLiveVideoWithSetting } from '@server/types/models'
import { LiveVideo, LiveVideoLatencyMode, VideoState } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from './video'
import { VideoBlacklistModel } from './video-blacklist'
import { VideoLiveReplaySettingModel } from './video-live-replay-setting'

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
    },
    {
      model: VideoLiveReplaySettingModel,
      required: false
    }
  ]
}))
@Table({
  tableName: 'videoLive',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    },
    {
      fields: [ 'replaySettingId' ],
      unique: true
    }
  ]
})
export class VideoLiveModel extends Model<Partial<AttributesOnly<VideoLiveModel>>> {

  @AllowNull(true)
  @Column(DataType.STRING)
  streamKey: string

  @AllowNull(false)
  @Column
  saveReplay: boolean

  @AllowNull(false)
  @Column
  permanentLive: boolean

  @AllowNull(false)
  @Column
  latencyMode: LiveVideoLatencyMode

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

  @ForeignKey(() => VideoLiveReplaySettingModel)
  @Column
  replaySettingId: number

  @BelongsTo(() => VideoLiveReplaySettingModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  ReplaySetting: VideoLiveReplaySettingModel

  @BeforeDestroy
  static deleteReplaySetting (instance: VideoLiveModel, options: { transaction: Transaction }) {
    return VideoLiveReplaySettingModel.destroy({
      where: {
        id: instance.replaySettingId
      },
      transaction: options.transaction
    })
  }

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
        },
        {
          model: VideoLiveReplaySettingModel.unscoped(),
          required: false
        }
      ]
    }

    return VideoLiveModel.findOne<MVideoLiveVideoWithSetting>(query)
  }

  static loadByVideoId (videoId: number) {
    const query = {
      where: {
        videoId
      }
    }

    return VideoLiveModel.findOne<MVideoLive>(query)
  }

  toFormattedJSON (canSeePrivateInformation: boolean): LiveVideo {
    let privateInformation: Pick<LiveVideo, 'rtmpUrl' | 'rtmpsUrl' | 'streamKey'> | {} = {}

    // If we don't have a stream key, it means this is a remote live so we don't specify the rtmp URL
    // We also display these private information only to the live owne/moderators
    if (this.streamKey && canSeePrivateInformation === true) {
      privateInformation = {
        streamKey: this.streamKey,

        rtmpUrl: CONFIG.LIVE.RTMP.ENABLED
          ? WEBSERVER.RTMP_URL
          : null,

        rtmpsUrl: CONFIG.LIVE.RTMPS.ENABLED
          ? WEBSERVER.RTMPS_URL
          : null
      }
    }

    const replaySettings = this.replaySettingId
      ? this.ReplaySetting.toFormattedJSON()
      : undefined

    return {
      ...privateInformation,

      permanentLive: this.permanentLive,
      saveReplay: this.saveReplay,
      replaySettings,
      latencyMode: this.latencyMode
    }
  }
}
