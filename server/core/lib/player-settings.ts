import { PlayerChannelSettings, PlayerVideoSettings, VideoChannelActivityAction } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { MChannelDefault, MUserAccountId, MVideoId } from '@server/types/models/index.js'

export async function upsertPlayerSettings (options: {
  user: MUserAccountId
  settings: PlayerVideoSettings | PlayerChannelSettings
  channel: MChannelDefault
  video: MVideoId
}) {
  const { user, settings, channel, video } = options

  if (!channel && !video) throw new Error('channel or video must be specified')

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      const setting = channel
        ? await PlayerSettingModel.loadByChannelId(channel.id, transaction)
        : await PlayerSettingModel.loadByVideoId(video.id, transaction)

      if (setting) await setting.destroy({ transaction })

      const playerSettings = await PlayerSettingModel.create({
        theme: settings.theme,
        channelId: channel?.id,
        videoId: video?.id
      }, { transaction })

      if (user && channel) {
        await VideoChannelActivityModel.addChannelActivity({
          action: VideoChannelActivityAction.UPDATE,
          user,
          channel,
          transaction
        })
      }

      return playerSettings
    })
  })
}
