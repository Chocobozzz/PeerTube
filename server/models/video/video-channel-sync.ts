import { isVideoChannelSyncStateValid } from "@server/helpers/custom-validators/video-channel-syncs"
import { CONSTRAINTS_FIELDS, VIDEO_CHANNEL_SYNC_STATE } from "@server/initializers/constants"
import { VideoChannelSync, VideoChannelSyncState } from "@shared/models"
import { MChannelSyncFormattable } from "@server/types/models/video/video-channel-sync"
import { AttributesOnly } from "@shared/typescript-utils"
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Is,
  Model,
  Table,
  UpdatedAt
} from "sequelize-typescript"
import { AccountModel } from "../account/account"
import { getSort, throwIfNotValid } from "../utils"
import { VideoChannelModel } from "./video-channel"
import { ActorModel } from "../actor/actor"
import { Op } from "sequelize"
import { UserModel } from "../user/user"
import { isUrlValid } from "@server/helpers/custom-validators/activitypub/misc"

type AvailableForListOptions = {
  accountId: number
  search?: string
  host?: string
  handles?: string[]
  forCount?: boolean
}

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

  static listByAccountForAPI (options: Pick<AvailableForListOptions, 'accountId'> & {
    start: number
    count: number
    sort: string
  }) {
    const getQuery = (forCount: boolean) => {
      const accountModel = forCount
        ? AccountModel.unscoped()
        : AccountModel

      return {
        offset: options.start,
        limit: options.count,
        order: getSort(options.sort),
        include: [
          {
            model: VideoChannelModel.unscoped(),
            required: true,
            include: [
              {
                model: accountModel,
                where: {
                  id: options.accountId
                },
                required: true
              },
              {
                model: ActorModel.unscoped()
              }
            ]
          }
        ]
      }
    }

    return Promise.all([
      VideoChannelSyncModel.count(getQuery(true)),
      VideoChannelSyncModel.findAll(getQuery(false))
    ]).then(([ total, data ]) => ({ total, data }))
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
      channel: this.VideoChannel.toFormattedSummaryJSON()
    }
  }

  static load (id: number) {
    return this.findOne({
      where: { id },
      include: [ {
        model: VideoChannelModel.unscoped(),
        required: true
      } ]
    })
  }

  static async listSyncs (): Promise<VideoChannelSyncModel[]> {
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
                where: {
                  videoQuota: {
                    [Op.ne]: 0
                  },
                  videoQuotaDaily: {
                    [Op.ne]: 0
                  }
                },
                required: true
              } ]
            }
          ]
        }
      ]
    }
    return VideoChannelSyncModel.unscoped().findAll(query)
  }

}
