import { ChannelExportJSON, PlayerChannelSettings } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MChannelBannerAccountDefault } from '@server/types/models/index.js'
import { MPlayerSetting } from '@server/types/models/video/player-setting.js'
import { ExportResult } from './abstract-user-exporter.js'
import { ActorExporter } from './actor-exporter.js'

export class ChannelsExporter extends ActorExporter<ChannelExportJSON> {
  async export () {
    const channelsJSON: ChannelExportJSON['channels'] = []
    let staticFiles: ExportResult<ChannelExportJSON>['staticFiles'] = []

    const channels = await VideoChannelModel.listAllOwnedByAccount(this.user.Account.id)

    for (const channel of channels) {
      try {
        const exported = await this.exportChannel(channel.id)

        channelsJSON.push(exported.json)
        staticFiles = staticFiles.concat(exported.staticFiles)
      } catch (err) {
        logger.warn('Cannot export channel %s.', channel.name, { err })
      }
    }

    return {
      json: { channels: channelsJSON },
      staticFiles
    }
  }

  private async exportChannel (channelId: number) {
    const [ channel, playerSettings ] = await Promise.all([
      VideoChannelModel.loadAndPopulateAccount(channelId),
      PlayerSettingModel.loadByChannelId(channelId)
    ])

    const { relativePathsFromJSON, staticFiles } = this.exportActorFiles(channel.Actor)

    return {
      json: this.exportChannelJSON(channel, playerSettings, relativePathsFromJSON),
      staticFiles
    }
  }

  // ---------------------------------------------------------------------------

  private exportChannelJSON (
    channel: MChannelBannerAccountDefault,
    playerSettings: MPlayerSetting,
    archiveFiles: { avatar: string, banner: string }
  ): ChannelExportJSON['channels'][0] {
    return {
      ...this.exportActorJSON(channel.Actor),

      displayName: channel.getDisplayName(),
      description: channel.description,
      support: channel.support,

      playerSettings: this.exportPlayerSettingsJSON(playerSettings),

      updatedAt: channel.updatedAt.toISOString(),
      createdAt: channel.createdAt.toISOString(),

      archiveFiles
    }
  }

  private exportPlayerSettingsJSON (playerSettings: MPlayerSetting) {
    if (!playerSettings) return null

    return {
      theme: playerSettings.theme as PlayerChannelSettings['theme']
    }
  }
}
