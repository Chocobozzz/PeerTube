import { LiveVideo, VideoState, type LiveVideoLatencyModeType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import {
  MVideoLiveVideoWithSetting,
  MVideoLiveVideoWithSettingSchedules,
  MVideoLiveWithSettingSchedules
} from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasMany,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { VideoBlacklistModel } from './video-blacklist.js'
import { VideoLiveReplaySettingModel } from './video-live-replay-setting.js'
import { VideoLiveScheduleModel } from './video-live-schedule.js'
import { VideoModel } from './video.js'

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
  declare streamKey: string

  @AllowNull(false)
  @Column
  declare saveReplay: boolean

  @AllowNull(false)
  @Column
  declare permanentLive: boolean

  @AllowNull(false)
  @Column
  declare latencyMode: LiveVideoLatencyModeType

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoLiveReplaySettingModel)
  @Column
  declare replaySettingId: number

  @BelongsTo(() => VideoLiveReplaySettingModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare ReplaySetting: Awaited<VideoLiveReplaySettingModel>

  @HasMany(() => VideoLiveScheduleModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  declare LiveSchedules: Awaited<VideoLiveScheduleModel>[]

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

    return VideoLiveModel.findOne<MVideoLiveWithSettingSchedules>(query)
  }

  static loadByVideoIdFull (videoId: number) {
    const query = {
      where: {
        videoId
      },
      include: [
        {
          model: VideoLiveReplaySettingModel.unscoped(),
          required: false
        },
        {
          model: VideoLiveScheduleModel.unscoped(),
          required: false
        }
      ]
    }

    return VideoLiveModel.findOne<MVideoLiveVideoWithSettingSchedules>(query)
  }

  toFormattedJSON (this: MVideoLiveWithSettingSchedules, canSeePrivateInformation: boolean): LiveVideo {
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
      latencyMode: this.latencyMode,
      schedules: (this.LiveSchedules || []).map(schedule => schedule.toFormattedJSON())
    }
  }
}
