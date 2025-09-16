import { VideoChannelSync, VideoChannelSyncState, type VideoChannelSyncStateType } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { isVideoChannelSyncStateValid } from '@server/helpers/custom-validators/video-channel-syncs.js'
import { CONSTRAINTS_FIELDS, VIDEO_CHANNEL_SYNC_STATE } from '@server/initializers/constants.js'
import { MChannelSync, MChannelSyncChannel, MChannelSyncFormattable } from '@server/types/models/index.js'
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
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, buildSQLAttributes, throwIfNotValid } from '../shared/index.js'
import { UserModel } from '../user/user.js'
import { VideoChannelSyncListQueryBuilder } from './sql/video-channel-sync/video-channel-sync-list-query-builder.js'
import { VideoChannelModel } from './video-channel.js'

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
export class VideoChannelSyncModel extends SequelizeModel<VideoChannelSyncModel> {
  @AllowNull(false)
  @Default(null)
  @Is('VideoChannelExternalChannelUrl', value => throwIfNotValid(value, isUrlValid, 'externalChannelUrl', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNEL_SYNCS.EXTERNAL_CHANNEL_URL.max))
  declare externalChannelUrl: string

  @AllowNull(false)
  @Default(VideoChannelSyncState.WAITING_FIRST_RUN)
  @Is('VideoChannelSyncState', value => throwIfNotValid(value, isVideoChannelSyncStateValid, 'state'))
  @Column
  declare state: VideoChannelSyncStateType

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastSyncAt: Date

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => VideoChannelModel)
  @Column
  declare videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare VideoChannel: Awaited<VideoChannelModel>

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static listByAccountForAPI (options: {
    accountId: number
    start: number
    count: number
    sort: string
    includeCollaborations: boolean
  }) {
    return Promise.all([
      new VideoChannelSyncListQueryBuilder(VideoChannelSyncModel.sequelize, options).list<MChannelSyncFormattable>(),
      new VideoChannelSyncListQueryBuilder(VideoChannelSyncModel.sequelize, options).count()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static countByAccount (accountId: number) {
    return new VideoChannelSyncListQueryBuilder(VideoChannelSyncModel.sequelize, { accountId }).count()
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

  static loadWithChannel (id: number): Promise<MChannelSyncChannel> {
    return VideoChannelSyncModel.findByPk(id)
  }

  // ---------------------------------------------------------------------------

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
