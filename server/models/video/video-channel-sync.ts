import { Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc'
import { isVideoChannelSyncStateValid } from '@server/helpers/custom-validators/video-channel-syncs'
import { CONSTRAINTS_FIELDS, VIDEO_CHANNEL_SYNC_STATE } from '@server/initializers/constants'
import { MChannelSync, MChannelSyncChannel, MChannelSyncFormattable } from '@server/types/models'
import { VideoChannelSync, VideoChannelSyncState } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { AccountModel } from '../account/account'
import { UserModel } from '../user/user'
import { getChannelSyncSort, throwIfNotValid } from '../shared'
import { VideoChannelModel } from './video-channel'

@DefaultScope(() => ({
  include: [
    {
      model: VideoChannelModel, // Default scope includes avatar and server
      required: true
    }
  ]
}))
@Table({
  tableName: 'videoChannelSync',
  indexes: [
    {
      fields: [ 'videoChannelId' ]
    }
  ]
})
export class VideoChannelSyncModel extends Model<Partial<AttributesOnly<VideoChannelSyncModel>>> {

  @AllowNull(false)
  @Default(null)
  @Is('VideoChannelExternalChannelUrl', value => throwIfNotValid(value, isUrlValid, 'externalChannelUrl', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNEL_SYNCS.EXTERNAL_CHANNEL_URL.max))
  externalChannelUrl: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoChannelModel)
  @Column
  videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoChannel: VideoChannelModel

  @AllowNull(false)
  @Default(VideoChannelSyncState.WAITING_FIRST_RUN)
  @Is('VideoChannelSyncState', value => throwIfNotValid(value, isVideoChannelSyncStateValid, 'state'))
  @Column
  state: VideoChannelSyncState

  @AllowNull(true)
  @Column(DataType.DATE)
  lastSyncAt: Date

  static listByAccountForAPI (options: {
    accountId: number
    start: number
    count: number
    sort: string
  }) {
    const getQuery = (forCount: boolean) => {
      const videoChannelModel = forCount
        ? VideoChannelModel.unscoped()
        : VideoChannelModel

      return {
        offset: options.start,
        limit: options.count,
        order: getChannelSyncSort(options.sort),
        include: [
          {
            model: videoChannelModel,
            required: true,
            where: {
              accountId: options.accountId
            }
          }
        ]
      }
    }

    return Promise.all([
      VideoChannelSyncModel.unscoped().count(getQuery(true)),
      VideoChannelSyncModel.unscoped().findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static countByAccount (accountId: number) {
    const query = {
      include: [
        {
          model: VideoChannelModel.unscoped(),
          required: true,
          where: {
            accountId
          }
        }
      ]
    }

    return VideoChannelSyncModel.unscoped().count(query)
  }

  static loadWithChannel (id: number): Promise<MChannelSyncChannel> {
    return VideoChannelSyncModel.findByPk(id)
  }

  static async listSyncs (): Promise<MChannelSync[]> {
    const query = {
      include: [
        {
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              model: AccountModel.unscoped(),
              required: true,
              include: [ {
                attributes: [],
                model: UserModel.unscoped(),
                required: true,
                where: {
                  videoQuota: {
                    [Op.ne]: 0
                  },
                  videoQuotaDaily: {
                    [Op.ne]: 0
                  }
                }
              } ]
            }
          ]
        }
      ]
    }
    return VideoChannelSyncModel.unscoped().findAll(query)
  }

  toFormattedJSON (this: MChannelSyncFormattable): VideoChannelSync {
    return {
      id: this.id,
      state: {
        id: this.state,
        label: VIDEO_CHANNEL_SYNC_STATE[this.state]
      },
      externalChannelUrl: this.externalChannelUrl,
      createdAt: this.createdAt.toISOString(),
      channel: this.VideoChannel.toFormattedSummaryJSON(),
      lastSyncAt: this.lastSyncAt?.toISOString()
    }
  }
}
