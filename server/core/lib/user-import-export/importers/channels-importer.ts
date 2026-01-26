import { pick } from '@peertube/peertube-core-utils'
import { ActorImageType, ChannelExportJSON } from '@peertube/peertube-models'
import { isPlayerChannelThemeSettingValid } from '@server/helpers/custom-validators/player-settings.js'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelDisplayNameValid,
  isVideoChannelSupportValid,
  isVideoChannelUsernameValid
} from '@server/helpers/custom-validators/video-channels.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { updateLocalActorImageFiles } from '@server/lib/local-actor.js'
import { createLocalVideoChannelWithoutKeys } from '@server/lib/video-channel.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MChannelId } from '@server/types/models/index.js'
import { AbstractUserImporter } from './abstract-user-importer.js'

const lTags = loggerTagsFactory('user-import')

type SanitizedObject = Pick<
  ChannelExportJSON['channels'][0],
  'name' | 'displayName' | 'description' | 'support' | 'playerSettings' | 'archiveFiles'
>

export class ChannelsImporter extends AbstractUserImporter<ChannelExportJSON, ChannelExportJSON['channels'][0], SanitizedObject> {
  protected getImportObjects (json: ChannelExportJSON) {
    return json.channels
  }

  protected sanitize (channelImportData: ChannelExportJSON['channels'][0]) {
    if (!isVideoChannelUsernameValid(channelImportData.name)) return undefined
    if (!isVideoChannelDisplayNameValid(channelImportData.displayName)) return undefined

    if (!isVideoChannelDescriptionValid(channelImportData.description)) channelImportData.description = null
    if (!isVideoChannelSupportValid(channelImportData.support)) channelImportData.support = null

    if (channelImportData.playerSettings) {
      if (!isPlayerChannelThemeSettingValid(channelImportData.playerSettings.theme)) channelImportData.playerSettings.theme = undefined
    }

    return pick(channelImportData, [ 'name', 'displayName', 'description', 'support', 'playerSettings', 'archiveFiles' ])
  }

  protected async importObject (channelImportData: SanitizedObject) {
    const account = this.user.Account
    const existingChannel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(channelImportData.name)

    if (existingChannel) {
      logger.info(`Do not import channel ${existingChannel.name} that already exists on this PeerTube instance`, lTags())
    } else {
      const videoChannelCreated = await sequelizeTypescript.transaction(async t => {
        return createLocalVideoChannelWithoutKeys(pick(channelImportData, [ 'displayName', 'name', 'description', 'support' ]), account, t)
      })

      await this.importPlayerSettings(videoChannelCreated, channelImportData)

      await JobQueue.Instance.createJob({ type: 'actor-keys', payload: { actorId: videoChannelCreated.Actor.id } })

      for (const type of [ ActorImageType.AVATAR, ActorImageType.BANNER ]) {
        const relativePath = type === ActorImageType.AVATAR
          ? channelImportData.archiveFiles.avatar
          : channelImportData.archiveFiles.banner

        if (!relativePath) continue

        const absolutePath = this.getSafeArchivePathOrThrow(relativePath)
        if (!await this.isFileValidOrLog(absolutePath, CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max)) continue

        await updateLocalActorImageFiles({
          accountOrChannel: videoChannelCreated,
          imagePhysicalFile: { path: absolutePath },
          type,
          sendActorUpdate: false
        })
      }

      logger.info('Video channel %s imported.', channelImportData.name, lTags())
    }

    return {
      duplicate: !!existingChannel
    }
  }

  private async importPlayerSettings (channel: MChannelId, channelImportData: SanitizedObject) {
    const playerSettings = channelImportData.playerSettings
    if (!playerSettings?.theme) return

    await PlayerSettingModel.create({
      theme: playerSettings.theme,
      channelId: channel.id
    })
  }
}
