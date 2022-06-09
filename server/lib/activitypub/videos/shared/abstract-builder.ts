import { Transaction } from 'sequelize/types'
import { checkUrlsSameHost } from '@server/helpers/activitypub'
import { deleteNonExistingModels } from '@server/helpers/database-utils'
import { logger, LoggerTagsFn } from '@server/helpers/logger'
import { updatePlaceholderThumbnail, updateVideoMiniatureFromUrl } from '@server/lib/thumbnail'
import { setVideoTags } from '@server/lib/video'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylistFilesVideo, MThumbnail, MVideoCaption, MVideoFile, MVideoFullLight, MVideoThumbnail } from '@server/types/models'
import { ActivityTagObject, ThumbnailType, VideoObject, VideoStreamingPlaylistType } from '@shared/models'
import { getOrCreateAPActor } from '../../actors'
import {
  getCaptionAttributesFromObject,
  getFileAttributesFromUrl,
  getLiveAttributesFromObject,
  getPreviewFromIcons,
  getStreamingPlaylistAttributesFromObject,
  getTagsFromObject,
  getThumbnailFromIcons
} from './object-to-model-attributes'
import { getTrackerUrls, setVideoTrackers } from './trackers'

export abstract class APVideoAbstractBuilder {
  protected abstract videoObject: VideoObject
  protected abstract lTags: LoggerTagsFn

  protected async getOrCreateVideoChannelFromVideoObject () {
    const channel = this.videoObject.attributedTo.find(a => a.type === 'Group')
    if (!channel) throw new Error('Cannot find associated video channel to video ' + this.videoObject.url)

    if (checkUrlsSameHost(channel.id, this.videoObject.id) !== true) {
      throw new Error(`Video channel url ${channel.id} does not have the same host than video object id ${this.videoObject.id}`)
    }

    return getOrCreateAPActor(channel.id, 'all')
  }

  protected tryToGenerateThumbnail (video: MVideoThumbnail): Promise<MThumbnail> {
    return updateVideoMiniatureFromUrl({
      downloadUrl: getThumbnailFromIcons(this.videoObject).url,
      video,
      type: ThumbnailType.MINIATURE
    }).catch(err => {
      logger.warn('Cannot generate thumbnail of %s.', this.videoObject.id, { err, ...this.lTags() })

      return undefined
    })
  }

  protected async setPreview (video: MVideoFullLight, t?: Transaction) {
    // Don't fetch the preview that could be big, create a placeholder instead
    const previewIcon = getPreviewFromIcons(this.videoObject)
    if (!previewIcon) return

    const previewModel = updatePlaceholderThumbnail({
      fileUrl: previewIcon.url,
      video,
      type: ThumbnailType.PREVIEW,
      size: previewIcon
    })

    await video.addAndSaveThumbnail(previewModel, t)
  }

  protected async setTags (video: MVideoFullLight, t: Transaction) {
    const tags = getTagsFromObject(this.videoObject)
    await setVideoTags({ video, tags, transaction: t })
  }

  protected async setTrackers (video: MVideoFullLight, t: Transaction) {
    const trackers = getTrackerUrls(this.videoObject, video)
    await setVideoTrackers({ video, trackers, transaction: t })
  }

  protected async insertOrReplaceCaptions (video: MVideoFullLight, t: Transaction) {
    const existingCaptions = await VideoCaptionModel.listVideoCaptions(video.id, t)

    let captionsToCreate = getCaptionAttributesFromObject(video, this.videoObject)
                            .map(a => new VideoCaptionModel(a) as MVideoCaption)

    for (const existingCaption of existingCaptions) {
      // Only keep captions that do not already exist
      const filtered = captionsToCreate.filter(c => !c.isEqual(existingCaption))

      // This caption already exists, we don't need to destroy and create it
      if (filtered.length !== captionsToCreate.length) {
        captionsToCreate = filtered
        continue
      }

      // Destroy this caption that does not exist anymore
      await existingCaption.destroy({ transaction: t })
    }

    for (const captionToCreate of captionsToCreate) {
      await captionToCreate.save({ transaction: t })
    }
  }

  protected async insertOrReplaceLive (video: MVideoFullLight, transaction: Transaction) {
    const attributes = getLiveAttributesFromObject(video, this.videoObject)
    const [ videoLive ] = await VideoLiveModel.upsert(attributes, { transaction, returning: true })

    video.VideoLive = videoLive
  }

  protected async setWebTorrentFiles (video: MVideoFullLight, t: Transaction) {
    const videoFileAttributes = getFileAttributesFromUrl(video, this.videoObject.url)
    const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

    // Remove video files that do not exist anymore
    const destroyTasks = deleteNonExistingModels(video.VideoFiles || [], newVideoFiles, t)
    await Promise.all(destroyTasks)

    // Update or add other one
    const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'video', t))
    video.VideoFiles = await Promise.all(upsertTasks)
  }

  protected async setStreamingPlaylists (video: MVideoFullLight, t: Transaction) {
    const streamingPlaylistAttributes = getStreamingPlaylistAttributesFromObject(video, this.videoObject, video.VideoFiles || [])
    const newStreamingPlaylists = streamingPlaylistAttributes.map(a => new VideoStreamingPlaylistModel(a))

    // Remove video playlists that do not exist anymore
    const destroyTasks = deleteNonExistingModels(video.VideoStreamingPlaylists || [], newStreamingPlaylists, t)
    await Promise.all(destroyTasks)

    video.VideoStreamingPlaylists = []

    for (const playlistAttributes of streamingPlaylistAttributes) {

      const streamingPlaylistModel = await this.insertOrReplaceStreamingPlaylist(playlistAttributes, t)
      streamingPlaylistModel.Video = video

      await this.setStreamingPlaylistFiles(video, streamingPlaylistModel, playlistAttributes.tagAPObject, t)

      video.VideoStreamingPlaylists.push(streamingPlaylistModel)
    }
  }

  private async insertOrReplaceStreamingPlaylist (attributes: VideoStreamingPlaylistModel['_creationAttributes'], t: Transaction) {
    const [ streamingPlaylist ] = await VideoStreamingPlaylistModel.upsert(attributes, { returning: true, transaction: t })

    return streamingPlaylist as MStreamingPlaylistFilesVideo
  }

  private getStreamingPlaylistFiles (video: MVideoFullLight, type: VideoStreamingPlaylistType) {
    const playlist = video.VideoStreamingPlaylists.find(s => s.type === type)
    if (!playlist) return []

    return playlist.VideoFiles
  }

  private async setStreamingPlaylistFiles (
    video: MVideoFullLight,
    playlistModel: MStreamingPlaylistFilesVideo,
    tagObjects: ActivityTagObject[],
    t: Transaction
  ) {
    const oldStreamingPlaylistFiles = this.getStreamingPlaylistFiles(video, playlistModel.type)

    const newVideoFiles: MVideoFile[] = getFileAttributesFromUrl(playlistModel, tagObjects).map(a => new VideoFileModel(a))

    const destroyTasks = deleteNonExistingModels(oldStreamingPlaylistFiles, newVideoFiles, t)
    await Promise.all(destroyTasks)

    // Update or add other one
    const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'streaming-playlist', t))
    playlistModel.VideoFiles = await Promise.all(upsertTasks)
  }
}
