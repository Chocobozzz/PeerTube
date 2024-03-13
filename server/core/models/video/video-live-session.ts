import { LiveVideoSession, type LiveVideoErrorType } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { MVideoLiveSession, MVideoLiveSessionReplay } from '@server/types/models/index.js'
import { FindOptions } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { VideoLiveReplaySettingModel } from './video-live-replay-setting.js'
import { VideoModel } from './video.js'
import { SequelizeModel } from '../shared/index.js'

export enum ScopeNames {
  WITH_REPLAY = 'WITH_REPLAY'
}

@Scopes(() => ({
  [ScopeNames.WITH_REPLAY]: {
    include: [
      {
        model: VideoModel.unscoped(),
        as: 'ReplayVideo',
        required: false
      },
      {
        model: VideoLiveReplaySettingModel,
        required: false
      }
    ]
  }
}))
@Table({
  tableName: 'videoLiveSession',
  indexes: [
    {
      fields: [ 'replayVideoId' ],
      unique: true
    },
    {
      fields: [ 'liveVideoId' ]
    },
    {
      fields: [ 'replaySettingId' ],
      unique: true
    }
  ]
})
export class VideoLiveSessionModel extends SequelizeModel<VideoLiveSessionModel> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column(DataType.DATE)
  startDate: Date

  @AllowNull(true)
  @Column(DataType.DATE)
  endDate: Date

  @AllowNull(true)
  @Column
  error: LiveVideoErrorType

  @AllowNull(false)
  @Column
  saveReplay: boolean

  @AllowNull(false)
  @Column
  endingProcessed: boolean

  @ForeignKey(() => VideoModel)
  @Column
  replayVideoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true,
      name: 'replayVideoId'
    },
    as: 'ReplayVideo',
    onDelete: 'set null'
  })
  ReplayVideo: Awaited<VideoModel>

  @ForeignKey(() => VideoModel)
  @Column
  liveVideoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true,
      name: 'liveVideoId'
    },
    as: 'LiveVideo',
    onDelete: 'set null'
  })
  LiveVideo: Awaited<VideoModel>

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
  static deleteReplaySetting (instance: VideoLiveSessionModel) {
    return VideoLiveReplaySettingModel.destroy({
      where: {
        id: instance.replaySettingId
      }
    })
  }

  static load (id: number): Promise<MVideoLiveSession> {
    return VideoLiveSessionModel.findOne({
      where: { id }
    })
  }

  static findSessionOfReplay (replayVideoId: number) {
    const query = {
      where: {
        replayVideoId
      }
    }

    return VideoLiveSessionModel.scope(ScopeNames.WITH_REPLAY).findOne(query)
  }

  static findCurrentSessionOf (videoUUID: string) {
    return VideoLiveSessionModel.findOne({
      where: {
        endDate: null
      },
      include: [
        {
          model: VideoModel.unscoped(),
          as: 'LiveVideo',
          required: true,
          where: {
            uuid: videoUUID
          }
        }
      ],
      order: [ [ 'startDate', 'DESC' ] ]
    })
  }

  static findLatestSessionOf (videoId: number) {
    return VideoLiveSessionModel.findOne({
      where: {
        liveVideoId: videoId
      },
      order: [ [ 'startDate', 'DESC' ] ]
    })
  }

  static listSessionsOfLiveForAPI (options: { videoId: number }) {
    const { videoId } = options

    const query: FindOptions<AttributesOnly<VideoLiveSessionModel>> = {
      where: {
        liveVideoId: videoId
      },
      order: [ [ 'startDate', 'ASC' ] ]
    }

    return VideoLiveSessionModel.scope(ScopeNames.WITH_REPLAY).findAll(query)
  }

  toFormattedJSON (this: MVideoLiveSessionReplay): LiveVideoSession {
    const replayVideo = this.ReplayVideo
      ? {
        id: this.ReplayVideo.id,
        uuid: this.ReplayVideo.uuid,
        shortUUID: uuidToShort(this.ReplayVideo.uuid)
      }
      : undefined

    const replaySettings = this.replaySettingId
      ? this.ReplaySetting.toFormattedJSON()
      : undefined

    return {
      id: this.id,
      startDate: this.startDate.toISOString(),
      endDate: this.endDate
        ? this.endDate.toISOString()
        : null,
      endingProcessed: this.endingProcessed,
      saveReplay: this.saveReplay,
      replaySettings,
      replayVideo,
      error: this.error
    }
  }
}
