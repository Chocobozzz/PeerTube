import {
  ActivityTagObject,
  ThumbnailType,
  VideoChaptersObject,
  VideoObject,
  VideoStreamingPlaylistType_Type
} from '@peertube/peertube-models'
import { isVideoChaptersObjectValid } from '@server/helpers/custom-validators/activitypub/video-chapters.js'
import { deleteAllModels, filterNonExistingModels, retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { LoggerTagsFn, logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { setAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { updateRemoteVideoThumbnail } from '@server/lib/thumbnail.js'
import { replaceChapters } from '@server/lib/video-chapters.js'
import { setVideoTags } from '@server/lib/video.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import {
  MStreamingPlaylistFiles,
  MStreamingPlaylistFilesVideo,
  MVideo,
  MVideoCaption,
  MVideoFile,
  MVideoFullLight,
  MVideoThumbnail
} from '@server/types/models/index.js'
import { CreationAttributes, Transaction } from 'sequelize'
import { fetchAP } from '../../activity.js'
import { findOwner, getOrCreateAPActor } from '../../actors/index.js'
import {
  getCaptionAttributesFromObject,
  getFileAttributesFromUrl,
  getLiveAttributesFromObject,
  getPreviewFromIcons,
  getStoryboardAttributeFromObject,
  getStreamingPlaylistAttributesFromObject,
  getTagsFromObject,
  getThumbnailFromIcons
} from './object-to-model-attributes.js'
import { getTrackerUrls, setVideoTrackers } from './trackers.js'

export abstract class APVideoAbstractBuilder {
  protected abstract videoObject: VideoObject
  protected abstract lTags: LoggerTagsFn

  protected async getOrCreateVideoChannelFromVideoObject () {
    const channel = await findOwner(this.videoObject.id, this.videoObject.attributedTo, 'Group')
    if (!channel) throw new Error('Cannot find associated video channel to video ' + this.videoObject.url)

    return getOrCreateAPActor(channel.id, 'all')
  }

  protected async setThumbnail (video: MVideoThumbnail, t?: Transaction) {
    const miniatureIcon = getThumbnailFromIcons(this.videoObject)
    if (!miniatureIcon) {
      logger.warn('Cannot find thumbnail in video object', { object: this.videoObject, ...this.lTags() })
      return undefined
    }

    const miniatureModel = updateRemoteVideoThumbnail({
      fileUrl: miniatureIcon.url,
      video,
      type: ThumbnailType.MINIATURE,
      size: miniatureIcon,
      onDisk: false // Lazy download remote thumbnails
    })

    await video.addAndSaveThumbnail(miniatureModel, t)
  }

  protected async setPreview (video: MVideoFullLight, t?: Transaction) {
    const previewIcon = getPreviewFromIcons(this.videoObject)
    if (!previewIcon) return

    const previewModel = updateRemoteVideoThumbnail({
      fileUrl: previewIcon.url,
      video,
      type: ThumbnailType.PREVIEW,
      size: previewIcon,
      onDisk: false // Lazy download remote previews
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

  protected async insertOrReplaceStoryboard (video: MVideoFullLight, t: Transaction) {
    const existingStoryboard = await StoryboardModel.loadByVideo(video.id, t)
    if (existingStoryboard) await existingStoryboard.destroy({ transaction: t })

    const storyboardAttributes = getStoryboardAttributeFromObject(video, this.videoObject)
    if (!storyboardAttributes) return

    return StoryboardModel.create(storyboardAttributes, { transaction: t })
  }

  protected async insertOrReplaceLive (video: MVideoFullLight, transaction: Transaction) {
    const attributes = getLiveAttributesFromObject(video, this.videoObject)
    const [ videoLive ] = await VideoLiveModel.upsert(attributes, { transaction, returning: true })

    video.VideoLive = videoLive
  }

  protected async setWebVideoFiles (video: MVideoFullLight, t: Transaction) {
    const videoFileAttributes = getFileAttributesFromUrl(video, this.videoObject.url)
    const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

    // Remove video files that do not exist anymore
    await deleteAllModels(filterNonExistingModels(video.VideoFiles || [], newVideoFiles), t)

    // Update or add other one
    const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'video', t))
    video.VideoFiles = await Promise.all(upsertTasks)
  }

  protected async updateChaptersOutsideTransaction (video: MVideoFullLight) {
    if (!this.videoObject.hasParts || typeof this.videoObject.hasParts !== 'string') return

    const { body } = await fetchAP<VideoChaptersObject>(this.videoObject.hasParts)
    if (!isVideoChaptersObjectValid(body)) {
      logger.warn('Chapters AP object is not valid, skipping', { body, ...this.lTags() })
      return
    }

    logger.debug('Fetched chapters AP object', { body, ...this.lTags() })

    return retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async t => {
        const chapters = body.hasPart.map(p => ({ title: p.name, timecode: p.startOffset }))

        await replaceChapters({ chapters, transaction: t, video })
      })
    })
  }

  protected async setStreamingPlaylists (video: MVideoFullLight, t: Transaction) {
    const streamingPlaylistAttributes = getStreamingPlaylistAttributesFromObject(video, this.videoObject)
    const newStreamingPlaylists = streamingPlaylistAttributes.map(a => new VideoStreamingPlaylistModel(a))

    // Remove video playlists that do not exist anymore
    await deleteAllModels(filterNonExistingModels(video.VideoStreamingPlaylists || [], newStreamingPlaylists), t)

    const oldPlaylists = video.VideoStreamingPlaylists
    video.VideoStreamingPlaylists = []

    for (const playlistAttributes of streamingPlaylistAttributes) {
      const streamingPlaylistModel = await this.insertOrReplaceStreamingPlaylist(playlistAttributes, t)
      streamingPlaylistModel.Video = video

      await this.setStreamingPlaylistFiles(oldPlaylists, streamingPlaylistModel, playlistAttributes.tagAPObject, t)

      video.VideoStreamingPlaylists.push(streamingPlaylistModel)
    }
  }

  private async insertOrReplaceStreamingPlaylist (attributes: CreationAttributes<VideoStreamingPlaylistModel>, t: Transaction) {
    const [ streamingPlaylist ] = await VideoStreamingPlaylistModel.upsert(attributes, { returning: true, transaction: t })

    return streamingPlaylist as MStreamingPlaylistFilesVideo
  }

  private getStreamingPlaylistFiles (oldPlaylists: MStreamingPlaylistFiles[], type: VideoStreamingPlaylistType_Type) {
    const playlist = oldPlaylists.find(s => s.type === type)
    if (!playlist) return []

    return playlist.VideoFiles
  }

  private async setStreamingPlaylistFiles (
    oldPlaylists: MStreamingPlaylistFiles[],
    playlistModel: MStreamingPlaylistFilesVideo,
    tagObjects: ActivityTagObject[],
    t: Transaction
  ) {
    const oldStreamingPlaylistFiles = this.getStreamingPlaylistFiles(oldPlaylists || [], playlistModel.type)

    const newVideoFiles: MVideoFile[] = getFileAttributesFromUrl(playlistModel, tagObjects).map(a => new VideoFileModel(a))

    await deleteAllModels(filterNonExistingModels(oldStreamingPlaylistFiles, newVideoFiles), t)

    // Update or add other one
    const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'streaming-playlist', t))
    playlistModel.VideoFiles = await Promise.all(upsertTasks)
  }

  protected async setAutomaticTags (options: {
    video: MVideo
    oldVideo?: Pick<MVideo, 'name' | 'description'>
    transaction: Transaction
  }) {
    const { video, transaction, oldVideo } = options

    if (oldVideo && video.name === oldVideo.name && video.description === oldVideo.description) return

    const automaticTags = await new AutomaticTagger().buildVideoAutomaticTags({ video, transaction })
    await setAndSaveVideoAutomaticTags({ video, automaticTags, transaction })
  }
}
