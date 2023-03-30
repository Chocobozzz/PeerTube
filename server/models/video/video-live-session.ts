import { FindOptions } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { MVideoLiveSession, MVideoLiveSessionReplay } from '@server/types/models'
import { uuidToShort } from '@shared/extra-utils'
import { LiveVideoError, LiveVideoSession } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoModel } from './video'
import { VideoLiveReplaySettingModel } from './video-live-replay-setting'

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
export class VideoLiveSessionModel extends Model<Partial<AttributesOnly<VideoLiveSessionModel>>> {

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
  error: LiveVideoError

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
  ReplayVideo: VideoModel

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
  LiveVideo: VideoModel

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

  static findCurrentSessionOf (videoId: number) {
    return VideoLiveSessionModel.findOne({
      where: {
        liveVideoId: videoId,
        endDate: null
      },
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
