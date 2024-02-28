import { VideoPlaylistPrivacy, VideoPlaylistType, VideoPlaylistsExportJSON } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { buildUUID } from '@peertube/peertube-node-utils'
import {
  MChannelBannerAccountDefault, MVideoPlaylistFull,
  MVideoPlaylistThumbnail
} from '@server/types/models/index.js'
import { getLocalVideoPlaylistActivityPubUrl, getLocalVideoPlaylistElementActivityPubUrl } from '@server/lib/activitypub/url.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { sendCreateVideoPlaylist } from '@server/lib/activitypub/send/send-create.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { updateLocalPlaylistMiniatureFromExisting } from '@server/lib/thumbnail.js'
import { CONSTRAINTS_FIELDS, USER_IMPORT } from '@server/initializers/constants.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { loadOrCreateVideoIfAllowedForUser } from '@server/lib/model-loaders/video.js'
import {
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistNameValid,
  isVideoPlaylistPrivacyValid,
  isVideoPlaylistTimestampValid,
  isVideoPlaylistTypeValid
} from '@server/helpers/custom-validators/video-playlists.js'
import { isActorPreferredUsernameValid } from '@server/helpers/custom-validators/activitypub/actor.js'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { pick } from '@peertube/peertube-core-utils'
import { VideoModel } from '@server/models/video/video.js'
import { generateThumbnailForPlaylist } from '@server/lib/video-playlist.js'

const lTags = loggerTagsFactory('user-import')

type ImportObject = VideoPlaylistsExportJSON['videoPlaylists'][0]
type SanitizedObject = Pick<ImportObject, 'type' | 'displayName' | 'privacy' | 'elements' | 'description' | 'elements' | 'channel' |
'archiveFiles'>

export class VideoPlaylistsImporter extends AbstractUserImporter <VideoPlaylistsExportJSON, ImportObject, SanitizedObject> {

  protected getImportObjects (json: VideoPlaylistsExportJSON) {
    return json.videoPlaylists
  }

  protected sanitize (o: ImportObject) {
    if (!isVideoPlaylistTypeValid(o.type)) return undefined
    if (!isVideoPlaylistNameValid(o.displayName)) return undefined
    if (!isVideoPlaylistPrivacyValid(o.privacy)) return undefined
    if (!isArray(o.elements)) return undefined

    if (o.channel?.name && !isActorPreferredUsernameValid(o.channel.name)) o.channel = undefined
    if (!isVideoPlaylistDescriptionValid(o.description)) o.description = undefined

    o.elements = o.elements.filter(e => {
      if (!isUrlValid(e.videoUrl)) return false
      if (e.startTimestamp && !isVideoPlaylistTimestampValid(e.startTimestamp)) return false
      if (e.stopTimestamp && !isVideoPlaylistTimestampValid(e.stopTimestamp)) return false

      return true
    })

    return pick(o, [ 'type', 'displayName', 'privacy', 'elements', 'channel', 'description', 'archiveFiles' ])
  }

  protected async importObject (playlistImportData: SanitizedObject) {
    const existingPlaylist = await VideoPlaylistModel.loadRegularByAccountAndName(this.user.Account, playlistImportData.displayName)

    if (existingPlaylist) {
      logger.info(`Do not import playlist ${playlistImportData.displayName} that already exists in the account`, lTags())
      return { duplicate: true }
    }

    const videoPlaylist = playlistImportData.type === VideoPlaylistType.WATCH_LATER
      ? await this.getWatchLaterPlaylist()
      : await this.createPlaylist(playlistImportData)

    await this.createElements(videoPlaylist, playlistImportData)

    await sendCreateVideoPlaylist(videoPlaylist, undefined)

    logger.info('Video playlist %s imported.', videoPlaylist.name, lTags(videoPlaylist.uuid))

    return { duplicate: false }
  }

  private async createPlaylist (playlistImportData: SanitizedObject) {
    let videoChannel: MChannelBannerAccountDefault

    if (playlistImportData.channel.name) {
      videoChannel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(playlistImportData.channel.name)

      if (!videoChannel) throw new Error(`Channel ${playlistImportData} not found`)
      if (videoChannel.accountId !== this.user.Account.id) {
        throw new Error(`Channel ${videoChannel.name} is not owned by user ${this.user.username}`)
      }
    } else if (playlistImportData.privacy !== VideoPlaylistPrivacy.PRIVATE) {
      throw new Error('Cannot create a non private playlist without channel')
    }

    const playlist: MVideoPlaylistFull = new VideoPlaylistModel({
      name: playlistImportData.displayName,
      description: playlistImportData.description,
      privacy: playlistImportData.privacy,

      uuid: buildUUID(),
      videoChannelId: videoChannel?.id,
      ownerAccountId: this.user.Account.id
    })
    playlist.url = getLocalVideoPlaylistActivityPubUrl(playlist)
    playlist.VideoChannel = videoChannel
    playlist.OwnerAccount = this.user.Account

    await saveInTransactionWithRetries(playlist)

    await this.createThumbnail(playlist, playlistImportData)

    return playlist
  }

  private async getWatchLaterPlaylist () {
    return VideoPlaylistModel.loadWatchLaterOf(this.user.Account)
  }

  private async createThumbnail (playlist: MVideoPlaylistThumbnail, playlistImportData: SanitizedObject) {
    const thumbnailPath = this.getSafeArchivePathOrThrow(playlistImportData.archiveFiles.thumbnail)
    if (!thumbnailPath) return undefined

    if (!await this.isFileValidOrLog(thumbnailPath, CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.IMAGE.FILE_SIZE.max)) return undefined

    const thumbnail = await updateLocalPlaylistMiniatureFromExisting({
      inputPath: thumbnailPath,
      playlist,
      automaticallyGenerated: false
    })

    await playlist.setAndSaveThumbnail(thumbnail, undefined)
  }

  private async createElements (playlist: MVideoPlaylistThumbnail, playlistImportData: SanitizedObject) {
    const elementsToCreate: { videoId: number, startTimestamp: number, stopTimestamp: number }[] = []

    for (const element of playlistImportData.elements.slice(0, USER_IMPORT.MAX_PLAYLIST_ELEMENTS)) {
      const video = await loadOrCreateVideoIfAllowedForUser(element.videoUrl)

      if (!video) {
        logger.debug(`Cannot get or create video ${element.videoUrl} to create playlist element in user import`, lTags())
        continue
      }

      elementsToCreate.push({
        videoId: video.id,
        startTimestamp: element.startTimestamp,
        stopTimestamp: element.stopTimestamp
      })
    }

    await sequelizeTypescript.transaction(async t => {
      let position = await VideoPlaylistElementModel.getNextPositionOf(playlist.id, t)

      for (const elementToCreate of elementsToCreate) {
        const playlistElement = new VideoPlaylistElementModel({
          position,
          startTimestamp: elementToCreate.startTimestamp,
          stopTimestamp: elementToCreate.stopTimestamp,
          videoPlaylistId: playlist.id,
          videoId: elementToCreate.videoId
        })
        await playlistElement.save({ transaction: t })

        playlistElement.url = getLocalVideoPlaylistElementActivityPubUrl(playlist, playlistElement)
        await playlistElement.save({ transaction: t })

        if (playlist.shouldGenerateThumbnailWithNewElement(playlistElement)) {
          const video = await VideoModel.loadFull(elementToCreate.videoId)

          generateThumbnailForPlaylist(playlist, video)
            .catch(err => logger.error('Cannot generate thumbnail from playlist', { err }))
        }

        position++
      }
    })
  }
}
