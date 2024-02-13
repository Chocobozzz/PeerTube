import { VideoModel } from '@server/models/video/video.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { ExportResult, AbstractUserExporter } from './abstract-user-exporter.js'
import {
  MStreamingPlaylistFiles,
  MThumbnail, MVideo, MVideoAP, MVideoCaption,
  MVideoCaptionLanguageUrl,
  MVideoChapter,
  MVideoFile,
  MVideoFullLight, MVideoLiveWithSetting,
  MVideoPassword
} from '@server/types/models/index.js'
import { logger } from '@server/helpers/logger.js'
import { ActivityCreate, VideoExportJSON, VideoObject, VideoPrivacy, FileStorage } from '@peertube/peertube-models'
import Bluebird from 'bluebird'
import { getHLSFileReadStream, getWebVideoFileReadStream } from '@server/lib/object-storage/videos.js'
import { createReadStream } from 'fs'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { extname, join } from 'path'
import { Readable } from 'stream'
import { getAudience, audiencify } from '@server/lib/activitypub/audience.js'
import { buildCreateActivity } from '@server/lib/activitypub/send/send-create.js'
import { pick } from '@peertube/peertube-core-utils'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import { buildChaptersAPHasPart } from '@server/lib/activitypub/video-chapters.js'

export class VideosExporter extends AbstractUserExporter <VideoExportJSON> {

  constructor (private readonly options: ConstructorParameters<typeof AbstractUserExporter<VideoExportJSON>>[0] & {
    withVideoFiles: boolean
  }) {
    super(options)
  }

  async export () {
    const videosJSON: VideoExportJSON['videos'] = []
    const activityPubOutbox: ActivityCreate<VideoObject>[] = []
    let staticFiles: ExportResult<VideoExportJSON>['staticFiles'] = []

    const channels = await VideoChannelModel.listAllByAccount(this.user.Account.id)

    for (const channel of channels) {
      const videoIds = await VideoModel.getAllIdsFromChannel(channel)

      await Bluebird.map(videoIds, async id => {
        try {
          const exported = await this.exportVideo(id)

          videosJSON.push(exported.json)
          staticFiles = staticFiles.concat(exported.staticFiles)
          activityPubOutbox.push(exported.activityPubOutbox)
        } catch (err) {
          logger.warn('Cannot export video %d.', id, { err })
        }
      }, { concurrency: 10 })
    }

    return {
      json: { videos: videosJSON },
      activityPubOutbox,
      staticFiles
    }
  }

  private async exportVideo (videoId: number) {
    const [ video, captions, source, chapters ] = await Promise.all([
      VideoModel.loadFull(videoId),
      VideoCaptionModel.listVideoCaptions(videoId),
      VideoSourceModel.loadLatest(videoId),
      VideoChapterModel.listChaptersOfVideo(videoId)
    ])

    const passwords = video.privacy === VideoPrivacy.PASSWORD_PROTECTED
      ? (await VideoPasswordModel.listPasswords({ videoId, start: 0, count: undefined, sort: 'createdAt' })).data
      : []

    const live = video.isLive
      ? await VideoLiveModel.loadByVideoIdWithSettings(videoId)
      : undefined;

    // We already have captions, so we can set it to the video object
    (video as any).VideoCaptions = captions
    // Then fetch more attributes for AP serialization
    const videoAP = await video.lightAPToFullAP(undefined)

    const { relativePathsFromJSON, staticFiles } = this.exportVideoFiles({ video, captions })

    return {
      json: this.exportVideoJSON({ video, captions, live, passwords, source, chapters, archiveFiles: relativePathsFromJSON }),
      staticFiles,
      relativePathsFromJSON,
      activityPubOutbox: await this.exportVideoAP(videoAP, chapters)
    }
  }

  // ---------------------------------------------------------------------------

  private exportVideoJSON (options: {
    video: MVideoFullLight
    captions: MVideoCaption[]
    live: MVideoLiveWithSetting
    passwords: MVideoPassword[]
    source: MVideoSource
    chapters: MVideoChapter[]
    archiveFiles: VideoExportJSON['videos'][0]['archiveFiles']
  }): VideoExportJSON['videos'][0] {
    const { video, captions, live, passwords, source, chapters, archiveFiles } = options

    return {
      uuid: video.uuid,

      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
      publishedAt: video.publishedAt.toISOString(),
      originallyPublishedAt: video.originallyPublishedAt
        ? video.originallyPublishedAt.toISOString()
        : undefined,

      name: video.name,
      category: video.category,
      licence: video.licence,
      language: video.language,
      tags: video.Tags.map(t => t.name),

      privacy: video.privacy,
      passwords: passwords.map(p => p.password),

      duration: video.duration,

      description: video.description,
      support: video.support,

      isLive: video.isLive,
      live: this.exportLiveJSON(video, live),

      url: video.url,

      thumbnailUrl: video.getMiniature()?.getOriginFileUrl(video) || null,
      previewUrl: video.getPreview()?.getOriginFileUrl(video) || null,

      views: video.views,

      likes: video.likes,
      dislikes: video.dislikes,

      nsfw: video.nsfw,

      commentsEnabled: video.commentsEnabled,
      downloadEnabled: video.downloadEnabled,

      waitTranscoding: video.waitTranscoding,
      state: video.state,

      channel: {
        name: video.VideoChannel.Actor.preferredUsername
      },

      captions: this.exportCaptionsJSON(video, captions),
      chapters: this.exportChaptersJSON(chapters),

      files: this.exportFilesJSON(video, video.VideoFiles),

      streamingPlaylists: this.exportStreamingPlaylistsJSON(video, video.VideoStreamingPlaylists),

      source: source
        ? { filename: source.filename }
        : null,

      archiveFiles
    }
  }

  private exportLiveJSON (video: MVideo, live: MVideoLiveWithSetting) {
    if (!video.isLive) return undefined

    return {
      saveReplay: live.saveReplay,
      permanentLive: live.permanentLive,
      latencyMode: live.latencyMode,
      streamKey: live.streamKey,

      replaySettings: live.ReplaySetting
        ? { privacy: live.ReplaySetting.privacy }
        : undefined
    }
  }

  private exportCaptionsJSON (video: MVideo, captions: MVideoCaption[]) {
    return captions.map(c => ({
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      language: c.language,
      filename: c.filename,
      fileUrl: c.getFileUrl(video)
    }))
  }

  private exportChaptersJSON (chapters: MVideoChapter[]) {
    return chapters.map(c => ({
      timecode: c.timecode,
      title: c.title
    }))
  }

  private exportFilesJSON (video: MVideo, files: MVideoFile[]) {
    return files.map(f => ({
      resolution: f.resolution,
      size: f.size,
      fps: f.fps,

      torrentUrl: f.getTorrentUrl(),
      fileUrl: f.getFileUrl(video)
    }))
  }

  private exportStreamingPlaylistsJSON (video: MVideo, streamingPlaylists: MStreamingPlaylistFiles[]) {
    return streamingPlaylists.map(p => ({
      type: p.type,
      playlistUrl: p.getMasterPlaylistUrl(video),
      segmentsSha256Url: p.getMasterPlaylistUrl(video),
      files: this.exportFilesJSON(video, p.VideoFiles)
    }))
  }

  // ---------------------------------------------------------------------------

  private async exportVideoAP (video: MVideoAP, chapters: MVideoChapter[]): Promise<ActivityCreate<VideoObject>> {
    const videoFile = video.getMaxQualityFile()
    const icon = video.getPreview()

    const audience = getAudience(video.VideoChannel.Account.Actor, video.privacy === VideoPrivacy.PUBLIC)
    const videoObject = {
      ...audiencify(await video.toActivityPubObject(), audience),

      icon: [
        {
          ...icon.toActivityPubObject(video),

          url: join(this.options.relativeStaticDirPath, this.getArchiveThumbnailFilePath(video, icon))
        }
      ],

      subtitleLanguage: video.VideoCaptions.map(c => ({
        ...c.toActivityPubObject(video),

        url: join(this.options.relativeStaticDirPath, this.getArchiveCaptionFilePath(video, c))
      })),

      hasParts: buildChaptersAPHasPart(video, chapters),

      attachment: this.options.withVideoFiles && videoFile
        ? [
          {
            type: 'Video' as 'Video',
            url: join(this.options.relativeStaticDirPath, this.getArchiveVideoFilePath(video, videoFile)),

            ...pick(videoFile.toActivityPubObject(video), [ 'mediaType', 'height', 'size', 'fps' ])
          }
        ]
        : undefined
    }

    return buildCreateActivity(video.url, video.VideoChannel.Account.Actor, videoObject, audience)
  }

  // ---------------------------------------------------------------------------

  private exportVideoFiles (options: {
    video: MVideoFullLight
    captions: MVideoCaption[]
  }) {
    const { video, captions } = options

    const staticFiles: ExportResult<VideoExportJSON>['staticFiles'] = []
    const relativePathsFromJSON = {
      videoFile: null as string,
      thumbnail: null as string,
      captions: {} as { [ lang: string ]: string }
    }

    const videoFile = video.getMaxQualityFile()

    if (this.options.withVideoFiles && videoFile) {
      staticFiles.push({
        archivePath: this.getArchiveVideoFilePath(video, videoFile),
        createrReadStream: () => this.generateVideoFileReadStream(video, videoFile)
      })

      relativePathsFromJSON.videoFile = join(this.relativeStaticDirPath, this.getArchiveVideoFilePath(video, videoFile))
    }

    for (const caption of captions) {
      staticFiles.push({
        archivePath: this.getArchiveCaptionFilePath(video, caption),
        createrReadStream: () => Promise.resolve(createReadStream(caption.getFSPath()))
      })

      relativePathsFromJSON.captions[caption.language] = join(this.relativeStaticDirPath, this.getArchiveCaptionFilePath(video, caption))
    }

    const thumbnail = video.getPreview() || video.getMiniature()
    if (thumbnail) {
      staticFiles.push({
        archivePath: this.getArchiveThumbnailFilePath(video, thumbnail),
        createrReadStream: () => Promise.resolve(createReadStream(thumbnail.getPath()))
      })

      relativePathsFromJSON.thumbnail = join(this.relativeStaticDirPath, this.getArchiveThumbnailFilePath(video, thumbnail))
    }

    return { staticFiles, relativePathsFromJSON }
  }

  private async generateVideoFileReadStream (video: MVideoFullLight, videoFile: MVideoFile): Promise<Readable> {
    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return createReadStream(VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile))
    }

    const { stream } = videoFile.isHLS()
      ? await getHLSFileReadStream({ playlist: video.getHLSPlaylist(), filename: videoFile.filename, rangeHeader: undefined })
      : await getWebVideoFileReadStream({ filename: videoFile.filename, rangeHeader: undefined })

    return stream
  }

  private getArchiveVideoFilePath (video: MVideo, videoFile: MVideoFile) {
    return join('video-files', video.uuid + extname(videoFile.filename))
  }

  private getArchiveCaptionFilePath (video: MVideo, caption: MVideoCaptionLanguageUrl) {
    return join('captions', video.uuid + '-' + caption.language + extname(caption.filename))
  }

  private getArchiveThumbnailFilePath (video: MVideo, thumbnail: MThumbnail) {
    return join('thumbnails', video.uuid + extname(thumbnail.filename))
  }
}
