import { LiveVideo, VideoState, type LiveVideoLatencyModeType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { MVideoLive, MVideoLiveVideoWithSetting, MVideoLiveWithSetting } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  DefaultScope,
  ForeignKey, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { VideoBlacklistModel } from './video-blacklist.js'
import { VideoLiveReplaySettingModel } from './video-live-replay-setting.js'
import { VideoModel } from './video.js'
import { SequelizeModel } from '../shared/index.js'

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
export class VideoLiveModel extends SequelizeModel<VideoLiveModel> {

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
  latencyMode: LiveVideoLatencyModeType

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
  Video: Awaited<VideoModel>

  @ForeignKey(() => VideoLiveReplaySettingModel)
  @Column
  replaySettingId: number

  @BelongsTo(() => VideoLiveReplaySettingModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  ReplaySetting: Awaited<VideoLiveReplaySettingModel>

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

  static loadByVideoIdWithSettings (videoId: number) {
    const query = {
      where: {
        videoId
      },
      include: [
        {
          model: VideoLiveReplaySettingModel.unscoped(),
          required: false
        }
      ]
    }

    return VideoLiveModel.findOne<MVideoLiveWithSetting>(query)
  }

  toFormattedJSON (canSeePrivateInformation: boolean): LiveVideo {
    let privateInformation: Pick<LiveVideo, 'rtmpUrl' | 'rtmpsUrl' | 'streamKey'> | {} = {}

    // If we don't have a stream key, it means this is a remote live so we don't specify the rtmp URL
    // We also display these private information only to the live owne/moderators
    if (this.streamKey && canSeePrivateInformation === true) {
      privateInformation = {
        streamKey: this.streamKey,

        rtmpUrl: CONFIG.LIVE.RTMP.ENABLED
          ? WEBSERVER.RTMP_BASE_LIVE_URL
          : null,

        rtmpsUrl: CONFIG.LIVE.RTMPS.ENABLED
          ? WEBSERVER.RTMPS_BASE_LIVE_URL
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
