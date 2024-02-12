import { logger } from '@server/helpers/logger.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { ExportResult } from './abstract-user-exporter.js'
import { ChannelExportJSON } from '@peertube/peertube-models'
import { MChannelBannerAccountDefault } from '@server/types/models/index.js'
import { ActorExporter } from './actor-exporter.js'

export class ChannelsExporter extends ActorExporter <ChannelExportJSON> {

  async export () {
    const channelsJSON: ChannelExportJSON['channels'] = []
    let staticFiles: ExportResult<ChannelExportJSON>['staticFiles'] = []

    const channels = await VideoChannelModel.listAllByAccount(this.user.Account.id)

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
    const channel = await VideoChannelModel.loadAndPopulateAccount(channelId)

    const { relativePathsFromJSON, staticFiles } = this.exportActorFiles(channel.Actor)

    return {
      json: this.exportChannelJSON(channel, relativePathsFromJSON),
      staticFiles
    }
  }

  // ---------------------------------------------------------------------------

  private exportChannelJSON (
    channel: MChannelBannerAccountDefault,
    archiveFiles: { avatar: string, banner: string }
  ): ChannelExportJSON['channels'][0] {
    return {
      ...this.exportActorJSON(channel.Actor),

      displayName: channel.getDisplayName(),
      description: channel.description,
      support: channel.support,

      updatedAt: channel.updatedAt.toISOString(),
      createdAt: channel.createdAt.toISOString(),

      archiveFiles
    }
  }

}
