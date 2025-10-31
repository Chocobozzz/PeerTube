import {
  ResultList,
  VideoChannelActivityAction,
  VideoChannelActivityTarget,
  type VideoChannelActivity,
  type VideoChannelActivityActionType,
  type VideoChannelActivityDetails,
  type VideoChannelActivityTargetType
} from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { VIDEO_CHANNEL_ACTIVITY_ACTIONS, VIDEO_CHANNEL_ACTIVITY_TARGETS } from '@server/initializers/constants.js'
import { MChannelId, MChannelSync, MUserAccountId, MVideo, MVideoImport, MVideoPlaylist } from '@server/types/models/index.js'
import { MChannelActivityFormattable } from '@server/types/models/video/video-channel-activity.js'
import { Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { AccountModel } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import { getSort, SequelizeModel } from '../shared/index.js'
import { VideoChannelSyncModel } from './video-channel-sync.js'
import { VideoChannelModel } from './video-channel.js'
import { VideoImportModel } from './video-import.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { VideoModel } from './video.js'

interface VideoChannelActivityData {
  video?: {
    id: number
    name: string
    uuid: string
    url: string
    isLive: boolean
  }

  videoImport?: {
    id: number
    name: string
    uuid: string
    url: string
    targetUrl: string
  }

  playlist?: {
    id: number
    name: string
    uuid: string
    url: string
  }

  channel?: {
    id: number
    name: string
    displayName: string
    url: string
  }

  channelSync?: {
    id: number
    externalChannelUrl: string
  }
}

@Table({
  tableName: 'videoChannelActivity',
  indexes: [
    {
      fields: [ 'videoChannelId' ]
    },
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoPlaylistId' ],
      where: {
        videoPlaylistId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoChannelSyncId' ],
      where: {
        videoChannelSyncId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoImportId' ],
      where: {
        videoImportId: {
          [Op.ne]: null
        }
      }
    }
  ]
})
export class VideoChannelActivityModel extends SequelizeModel<VideoChannelActivityModel> {
  @AllowNull(false)
  @Column
  declare action: VideoChannelActivityActionType

  @AllowNull(false)
  @Column
  declare targetType: VideoChannelActivityTargetType

  // Store association data in case they are deleted
  @AllowNull(false)
  @Column(DataType.JSONB)
  declare data: VideoChannelActivityData

  // More information about the action
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare details: VideoChannelActivityDetails

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

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare Account: Awaited<AccountModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  declare videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare VideoPlaylist: Awaited<VideoPlaylistModel>

  @ForeignKey(() => VideoChannelSyncModel)
  @Column
  declare videoChannelSyncId: number

  @BelongsTo(() => VideoChannelSyncModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare VideoChannelSync: Awaited<VideoChannelSyncModel>

  @ForeignKey(() => VideoImportModel)
  @Column
  declare videoImportId: number

  @BelongsTo(() => VideoImportModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare VideoImport: Awaited<VideoImportModel>

  // ---------------------------------------------------------------------------

  static async listForAPI (options: {
    channelId: number
    start: number
    count: number
    sort: string
  }): Promise<ResultList<MChannelActivityFormattable>> {
    const where = { videoChannelId: options.channelId }

    const countQuery = VideoChannelActivityModel.count({ where })
    const dataQuery = VideoChannelActivityModel.findAll({
      where,
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      include: [
        {
          model: VideoChannelModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'preferredUsername', 'url' ],
              model: ActorModel.unscoped()
            }
          ]
        },
        {
          model: AccountModel,
          required: false
        },
        {
          model: VideoModel.unscoped(),
          required: false
        },
        {
          model: VideoPlaylistModel.unscoped(),
          required: false
        },
        {
          model: VideoChannelSyncModel.unscoped(),
          required: false
        },
        {
          model: VideoImportModel.unscoped(),
          required: false,
          include: [
            {
              model: VideoModel.unscoped(),
              required: false
            }
          ]
        }
      ]
    })

    const [ total, data ] = await Promise.all([ countQuery, dataQuery ])

    return { total, data }
  }

  static async addVideoActivity (options: {
    action: VideoChannelActivityActionType
    user: MUserAccountId
    channel: MChannelId
    video: MVideo
    transaction: Transaction
  }) {
    const { action, user, channel, video, transaction } = options

    return this.create({
      action,
      targetType: VideoChannelActivityTarget.VIDEO,
      data: {
        video: {
          id: video.id,
          name: video.name,
          uuid: video.uuid,
          url: video.url,
          isLive: video.isLive
        }
      },
      details: null,
      accountId: user.Account.id,
      videoChannelId: channel.id,
      videoId: action !== VideoChannelActivityAction.DELETE
        ? video.id
        : null
    }, { transaction })
  }

  static async addVideoImportActivity (options: {
    action: VideoChannelActivityActionType
    user: MUserAccountId
    channel: MChannelId
    videoImport: MVideoImport
    video: MVideo
    transaction: Transaction
  }) {
    const { action, user, channel, video, videoImport, transaction } = options

    return this.create({
      action,
      targetType: VideoChannelActivityTarget.VIDEO_IMPORT,
      data: {
        videoImport: {
          id: video.id,
          name: video.name,
          uuid: video.uuid,
          url: video.url,
          targetUrl: videoImport.targetUrl
        }
      },
      details: null,
      accountId: user.Account.id,
      videoChannelId: channel.id,
      videoImportId: action !== VideoChannelActivityAction.DELETE
        ? videoImport.id
        : null
    }, { transaction })
  }

  static async addChannelActivity (options: {
    action: VideoChannelActivityActionType
    user: MUserAccountId
    channel: MChannelActivityFormattable['VideoChannel']
    transaction: Transaction
  }) {
    const { action, user, channel, transaction } = options

    return this.create({
      action,
      targetType: VideoChannelActivityTarget.CHANNEL,
      data: {
        channel: {
          id: channel.id,
          name: channel.Actor.preferredUsername,
          displayName: channel.name,
          url: channel.Actor.url
        }
      },
      details: null,
      accountId: user.Account.id,
      videoChannelId: channel.id
    }, { transaction })
  }

  static async addPlaylistActivity (options: {
    action: VideoChannelActivityActionType
    user: MUserAccountId
    channel: MChannelId
    playlist: MVideoPlaylist
    transaction: Transaction
  }) {
    const { action, user, channel, playlist, transaction } = options

    return this.create({
      action,
      targetType: VideoChannelActivityTarget.PLAYLIST,
      data: {
        playlist: {
          id: playlist.id,
          name: playlist.name,
          uuid: playlist.uuid,
          url: playlist.url
        }
      },
      details: null,
      accountId: user.Account.id,
      videoChannelId: channel.id,
      videoPlaylistId: action !== VideoChannelActivityAction.DELETE
        ? playlist.id
        : null
    }, { transaction })
  }

  static async addChannelSyncActivity (options: {
    action: VideoChannelActivityActionType
    user: MUserAccountId
    channel: MChannelId
    sync: MChannelSync
    transaction: Transaction
  }) {
    const { action, user, channel, sync, transaction } = options

    return this.create({
      action,
      targetType: VideoChannelActivityTarget.CHANNEL_SYNC,
      data: {
        channelSync: {
          id: sync.id,
          externalChannelUrl: sync.externalChannelUrl
        }
      },
      details: null,
      accountId: user.Account.id,
      videoChannelId: channel.id,
      videoChannelSyncId: action !== VideoChannelActivityAction.DELETE
        ? sync.id
        : null
    }, { transaction })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MChannelActivityFormattable): VideoChannelActivity {
    return {
      id: this.id,

      account: this.Account
        ? this.Account.toFormattedSummaryJSON()
        : null,

      action: {
        id: this.action,
        label: VIDEO_CHANNEL_ACTIVITY_ACTIONS[this.action]
      },

      targetType: {
        id: this.targetType,
        label: VIDEO_CHANNEL_ACTIVITY_TARGETS[this.targetType]
      },

      video: this.formatVideo(),
      playlist: this.formatPlaylist(),
      channel: this.formatChannel(),
      channelSync: this.formatSync(),
      videoImport: this.formatVideoImport(),

      details: this.details,
      createdAt: this.createdAt
    }
  }

  formatChannel (this: MChannelActivityFormattable): VideoChannelActivity['channel'] {
    return {
      id: this.VideoChannel.id,
      name: this.VideoChannel.Actor.preferredUsername,
      displayName: this.VideoChannel.name,
      url: this.VideoChannel.Actor.url
    }
  }

  formatVideo (this: MChannelActivityFormattable): VideoChannelActivity['video'] {
    if (this.targetType !== VideoChannelActivityTarget.VIDEO) return null

    const target = this.Video || this.data.video

    return {
      id: target.id,
      name: target.name,
      uuid: target.uuid,
      shortUUID: uuidToShort(target.uuid),
      isLive: target.isLive,
      url: target.url
    }
  }

  formatVideoImport (this: MChannelActivityFormattable): VideoChannelActivity['videoImport'] {
    if (this.targetType !== VideoChannelActivityTarget.VIDEO_IMPORT) return null

    if (this.VideoImport && this.VideoImport.Video) {
      return {
        id: this.VideoImport.id,
        name: this.VideoImport.Video.name,
        uuid: this.VideoImport.Video.uuid,
        shortUUID: uuidToShort(this.VideoImport.Video.uuid),
        url: this.VideoImport.Video.url,
        targetUrl: this.VideoImport.targetUrl
      }
    }

    return {
      id: this.data.videoImport.id,
      name: this.data.videoImport.name,
      uuid: this.data.videoImport.uuid,
      shortUUID: uuidToShort(this.data.videoImport.uuid),
      url: this.data.videoImport.url,
      targetUrl: this.data.videoImport.targetUrl
    }
  }

  formatPlaylist (this: MChannelActivityFormattable): VideoChannelActivity['playlist'] {
    if (this.targetType !== VideoChannelActivityTarget.PLAYLIST) return null

    const target = this.VideoPlaylist || this.data.playlist

    return {
      id: target.id,
      name: target.name,
      uuid: target.uuid,
      shortUUID: uuidToShort(target.uuid),
      url: target.url
    }
  }

  formatSync (): VideoChannelActivity['channelSync'] {
    if (this.targetType !== VideoChannelActivityTarget.CHANNEL_SYNC) return null

    const target = this.VideoChannelSync || this.data.channelSync

    return {
      id: target.id,
      externalChannelUrl: target.externalChannelUrl
    }
  }
}
