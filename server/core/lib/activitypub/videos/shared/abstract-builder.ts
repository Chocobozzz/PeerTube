import { guessAspectRatio } from '@peertube/peertube-core-utils'
import { ActivityTagObject, VideoChaptersObject, VideoObject, VideoStreamingPlaylistType_Type } from '@peertube/peertube-models'
import { isVideoChaptersObjectValid } from '@server/helpers/custom-validators/activitypub/video-chapters.js'
import { deleteAllModels, filterNonExistingModels, retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { LoggerTagsFn, logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { setAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { updateRemoteVideoThumbnail } from '@server/lib/thumbnail.js'
import { replaceChapters } from '@server/lib/video-chapters.js'
import { setVideoTags } from '@server/lib/video.js'
import { getServerAccount } from '@server/models/application/application.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoLiveScheduleModel } from '@server/models/video/video-live-schedule.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import {
  MStreamingPlaylistFiles,
  MStreamingPlaylistFilesVideo,
  MStreamingPlaylistFormattable,
  MVideo,
  MVideoCaption,
  MVideoFile,
  MVideoFull,
  MVideoThumbnails
} from '@server/types/models/index.js'
import { CreationAttributes, Transaction } from 'sequelize'
import { fetchAP } from '../../activity.js'
import { findOwner, getOrCreateAPActor } from '../../actors/index.js'
import { upsertAPPlayerSettings } from '../../player-settings.js'
import {
  getCaptionAttributesFromObject,
  getFileAttributesFromUrl,
  getLiveAttributesFromObject,
  getLiveSchedulesAttributesFromObject,
  getStoryboardAttributeFromObject,
  getStreamingPlaylistAttributesFromObject,
  getTagsFromObject
} from './object-to-model-attributes.js'
import { getTrackerUrls, setVideoTrackers } from './trackers.js'

export abstract class APVideoAbstractBuilder {
  protected abstract videoObject: VideoObject
  protected abstract lTags: LoggerTagsFn

  protected async getOrCreateVideoChannelFromVideoObject () {
    const channel = await findOwner({
      rootUrl: this.videoObject.id,
      attributedTo: this.videoObject.attributedTo,
      audience: this.videoObject.audience,
      type: 'Group'
    })

    if (!channel) throw new Error('Cannot find associated video channel to video ' + this.videoObject.id)

    return getOrCreateAPActor(channel.id, 'all')
  }

  protected async setThumbnails (video: MVideoThumbnails, t?: Transaction) {
    const icons = this.videoObject.icon
    if (icons.length === 0) {
      logger.warn('Cannot find thumbnails in video object', { object: this.videoObject, ...this.lTags() })
      return undefined
    }

    const thumbnails = icons.map(icon => {
      return updateRemoteVideoThumbnail({
        fileUrl: icon.url,
        video,
        size: { ...icon, aspectRatio: guessAspectRatio(icon.width, icon.height) }
      })
    })

    await video.replaceAndSaveThumbnails(thumbnails, t)
  }

  protected async setTags (video: MVideoFull, t: Transaction) {
    const tags = getTagsFromObject(this.videoObject)
    await setVideoTags({ video, tags, transaction: t })
  }

  protected async setTrackers (video: MVideoFull, t: Transaction) {
    const trackers = getTrackerUrls(this.videoObject, video)
    await setVideoTrackers({ video, trackers, transaction: t })
  }

  protected async insertOrReplaceCaptions (video: MVideoFull, t: Transaction) {
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

  protected async insertOrReplaceStoryboard (video: MVideoFull, t: Transaction) {
    const storyboardAttributes = getStoryboardAttributeFromObject(video, this.videoObject)

    const existingStoryboard = await StoryboardModel.loadByVideo(video.id, t)
    if (existingStoryboard?.fileUrl === storyboardAttributes?.fileUrl) return

    if (existingStoryboard) await existingStoryboard.destroy({ transaction: t })

    if (storyboardAttributes) {
      await StoryboardModel.create(storyboardAttributes, { transaction: t })
    }
  }

  protected async insertOrReplaceLive (video: MVideoFull, transaction: Transaction) {
    const attributes = getLiveAttributesFromObject(video, this.videoObject)
    const [ videoLive ] = await VideoLiveModel.upsert(attributes, { transaction, returning: true })

    await VideoLiveScheduleModel.deleteAllOfLiveId(videoLive.id, transaction)
    videoLive.LiveSchedules = []

    for (const scheduleAttributes of getLiveSchedulesAttributesFromObject(videoLive, this.videoObject)) {
      const scheduleModel = new VideoLiveScheduleModel(scheduleAttributes)

      videoLive.LiveSchedules.push(await scheduleModel.save({ transaction }))
    }
  }

  protected async setWebVideoFiles (video: MVideoFull, t: Transaction) {
    const oldFiles = video.VideoFiles || []

    const toCreate = getFileAttributesFromUrl(video, this.videoObject.url, oldFiles)
      .map(({ file, infoHash }) => ({ file: new VideoFileModel(file), infoHash }))

    video.VideoFiles = await this.saveFiles({ toCreate, oldFiles, t, mode: 'video' })
  }

  protected async updateChapters (video: MVideoFull) {
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

  protected async upsertPlayerSettings (video: MVideoFull) {
    if (typeof this.videoObject.playerSettings !== 'string') return

    await upsertAPPlayerSettings({
      settingsObject: this.videoObject.playerSettings,
      video,
      channel: undefined,
      contextUrl: video.url
    })
  }

  protected async setStreamingPlaylists (video: MVideoFull, t: Transaction) {
    const toCreate = getStreamingPlaylistAttributesFromObject(video, this.videoObject)

    // Remove video playlists that do not exist anymore
    await deleteAllModels(
      filterNonExistingModels(
        video.VideoStreamingPlaylists || [],
        toCreate.map(({ playlist }) => new VideoStreamingPlaylistModel(playlist))
      ),
      t
    )

    const oldPlaylists = video.VideoStreamingPlaylists
    video.VideoStreamingPlaylists = []

    for (const { playlist, tags, infoHashes } of toCreate) {
      const streamingPlaylistModel = await this.insertOrReplaceStreamingPlaylist(playlist, t)
      streamingPlaylistModel.Video = video

      await streamingPlaylistModel.setInfoHashes(infoHashes ?? [], t)

      await this.setStreamingPlaylistFiles(oldPlaylists, streamingPlaylistModel, tags ?? [], t)

      video.VideoStreamingPlaylists.push(streamingPlaylistModel)
    }
  }

  private async insertOrReplaceStreamingPlaylist (attributes: CreationAttributes<VideoStreamingPlaylistModel>, t: Transaction) {
    const [ streamingPlaylist ] = await VideoStreamingPlaylistModel.upsert(attributes, { returning: true, transaction: t })

    return streamingPlaylist as MStreamingPlaylistFilesVideo & MStreamingPlaylistFormattable
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

    const toCreate = getFileAttributesFromUrl(
      playlistModel,
      tagObjects,
      oldStreamingPlaylistFiles
    ).map(({ file, infoHash }) => ({ file: new VideoFileModel(file), infoHash }))

    playlistModel.VideoFiles = await this.saveFiles({ toCreate, oldFiles: oldStreamingPlaylistFiles, t, mode: 'streaming-playlist' })
  }

  protected async setAutomaticTags (options: {
    video: MVideo
    oldVideo?: Pick<MVideo, 'name' | 'description'>
    transaction: Transaction
  }) {
    const { video, transaction, oldVideo } = options

    if (video.name === oldVideo?.name && video.description === oldVideo.description) return {}

    const automaticTagsByAccount = await new AutomaticTagger().buildVideoAutomaticTags({
      serverAccount: await getServerAccount(),
      video,
      transaction
    })
    await setAndSaveVideoAutomaticTags({ video, automaticTagsByAccount, transaction })

    return automaticTagsByAccount
  }

  protected async saveFiles (options: {
    toCreate: { file: MVideoFile, infoHash: string }[]
    oldFiles: MVideoFile[]
    t: Transaction
    mode: 'video' | 'streaming-playlist'
  }) {
    const { toCreate, oldFiles, t, mode } = options

    // Remove video files that do not exist anymore
    await deleteAllModels(filterNonExistingModels(oldFiles, toCreate.map(({ file }) => file)), t)

    // Update or add other one
    const upsertTasks = toCreate.map(async ({ file, infoHash }) => {
      const newFile = await VideoFileModel.customUpsert(file, mode, t)

      newFile.InfoHash = await VideoInfohashModel.replaceFileInfohash(newFile.id, infoHash, t)

      return newFile
    })

    return Promise.all(upsertTasks)
  }
}
