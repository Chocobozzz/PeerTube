import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { PlayerChannelSettings, PlayerVideoSettings } from '../../../packages/models/src/videos/player-settings.js'
import { MChannelId, MVideoId } from '@server/types/models/index.js'

export async function upsertPlayerSettings (options: {
  settings: PlayerVideoSettings | PlayerChannelSettings
  channel: MChannelId
  video: MVideoId
}) {
  const { settings, channel, video } = options

  if (!channel && !video) throw new Error('channel or video must be specified')

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      const setting = channel
        ? await PlayerSettingModel.loadByChannelId(channel.id, transaction)
        : await PlayerSettingModel.loadByVideoId(video.id, transaction)

      if (setting) await setting.destroy({ transaction })

      return PlayerSettingModel.create({
        theme: settings.theme,
        channelId: channel?.id,
        videoId: video?.id
      }, { transaction })
    })
  })
}
