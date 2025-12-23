import type {
  PlayerChannelSettings,
  PlayerSettingsObject,
  PlayerThemeChannelSetting,
  PlayerThemeVideoSetting,
  PlayerVideoSettings
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { DEFAULT_CHANNEL_PLAYER_SETTING_VALUE, DEFAULT_INSTANCE_PLAYER_SETTING_VALUE } from '@server/initializers/constants.js'
import { getLocalChannelPlayerSettingsActivityPubUrl, getLocalVideoPlayerSettingsActivityPubUrl } from '@server/lib/activitypub/url.js'
import { MChannel, MChannelActorLight, MVideoUrl } from '@server/types/models/index.js'
import { MPlayerSetting } from '@server/types/models/video/player-setting.js'
import { Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel } from '../shared/index.js'
import { VideoChannelModel } from './video-channel.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'playerSetting',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    },
    {
      fields: [ 'channelId' ],
      unique: true
    }
  ]
})
export class PlayerSettingModel extends SequelizeModel<PlayerSettingModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Default(DEFAULT_INSTANCE_PLAYER_SETTING_VALUE)
  @Column
  declare theme: PlayerThemeVideoSetting | PlayerThemeChannelSetting

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoChannelModel)
  @Column
  declare channelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoChannel: Awaited<VideoChannelModel>

  static loadByVideoId (videoId: number, transaction?: Transaction) {
    return PlayerSettingModel.findOne<MPlayerSetting>({
      where: { videoId },
      transaction
    })
  }

  static loadByChannelId (channelId: number, transaction?: Transaction) {
    return PlayerSettingModel.findOne<MPlayerSetting>({
      where: { channelId },
      transaction
    })
  }

  static async loadByVideoIdOrChannelId (options: {
    videoId: number
    channelId: number
    transaction?: Transaction
  }) {
    const { videoId, channelId, transaction } = options

    const results = await PlayerSettingModel.findAll<MPlayerSetting>({
      where: {
        [Op.or]: [
          { videoId },
          { channelId }
        ]
      },
      transaction
    })

    const videoSetting = results.find(s => s.videoId === videoId)
    const channelSetting = results.find(s => s.channelId === channelId)

    return { videoSetting, channelSetting }
  }

  // ---------------------------------------------------------------------------

  static formatVideoPlayerSetting (options: {
    videoSetting: MPlayerSetting
    channelSetting: MPlayerSetting
  }): PlayerVideoSettings {
    const { videoSetting, channelSetting } = options

    const channelFormattedSetting = this.formatChannelPlayerSetting({ channelSetting })
    if (!videoSetting) return channelFormattedSetting

    let theme: PlayerThemeVideoSetting
    if (videoSetting.theme === DEFAULT_CHANNEL_PLAYER_SETTING_VALUE) {
      theme = channelFormattedSetting.theme
    } else if (videoSetting.theme === DEFAULT_INSTANCE_PLAYER_SETTING_VALUE) {
      theme = CONFIG.DEFAULTS.PLAYER.THEME
    } else {
      theme = videoSetting.theme
    }

    return {
      theme
    }
  }

  static formatVideoPlayerRawSetting (videoSetting: MPlayerSetting) {
    return {
      theme: videoSetting?.theme ?? DEFAULT_CHANNEL_PLAYER_SETTING_VALUE
    }
  }

  static formatChannelPlayerSetting (options: {
    channelSetting: MPlayerSetting
  }): PlayerChannelSettings {
    const { channelSetting } = options

    const instanceSetting = {
      theme: CONFIG.DEFAULTS.PLAYER.THEME
    }

    if (!channelSetting) return instanceSetting

    return {
      theme: channelSetting.theme === DEFAULT_INSTANCE_PLAYER_SETTING_VALUE
        ? instanceSetting.theme
        : channelSetting.theme as PlayerThemeChannelSetting
    }
  }

  static formatChannelPlayerRawSetting (channelSetting: MPlayerSetting) {
    return {
      theme: channelSetting?.theme ?? DEFAULT_INSTANCE_PLAYER_SETTING_VALUE
    }
  }

  // ---------------------------------------------------------------------------

  static formatAPPlayerSetting (options: {
    settings: MPlayerSetting
    channel: MChannel & MChannelActorLight
    video: MVideoUrl
  }): PlayerSettingsObject {
    const { channel, settings, video } = options

    const json = video
      ? this.formatVideoPlayerRawSetting(settings)
      : this.formatChannelPlayerRawSetting(settings)

    return {
      id: video
        ? getLocalVideoPlayerSettingsActivityPubUrl(video)
        : getLocalChannelPlayerSettingsActivityPubUrl(channel.Actor.preferredUsername),

      object: video?.url || channel?.Actor.url,
      type: 'PlayerSettings',

      theme: json.theme
    }
  }
}
