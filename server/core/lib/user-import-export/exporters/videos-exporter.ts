import { pick, sortBy } from '@peertube/peertube-core-utils'
import { ActivityCreate, FileStorage, VideoExportJSON, VideoObject, VideoPrivacy } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { audiencify, getVideoAudience } from '@server/lib/activitypub/audience.js'
import { buildCreateActivity } from '@server/lib/activitypub/send/send-create.js'
import { buildChaptersAPHasPart } from '@server/lib/activitypub/video-chapters.js'
import {
  getCaptionReadStream,
  getHLSFileReadStream,
  getOriginalFileReadStream,
  getWebVideoFileReadStream
} from '@server/lib/object-storage/videos.js'
import { VideoDownload } from '@server/lib/video-download.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MStreamingPlaylistFiles,
  MThumbnail,
  MVideo,
  MVideoAP,
  MVideoCaption,
  MVideoCaptionLanguageUrl,
  MVideoChapter,
  MVideoFile,
  MVideoFullLight,
  MVideoLiveWithSettingSchedules,
  MVideoPassword
} from '@server/types/models/index.js'
import { MPlayerSetting } from '@server/types/models/video/player-setting.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import Bluebird from 'bluebird'
import { createReadStream } from 'fs'
import { extname, join } from 'path'
import { PassThrough, Readable } from 'stream'
import { AbstractUserExporter, ExportResult } from './abstract-user-exporter.js'

export class VideosExporter extends AbstractUserExporter<VideoExportJSON> {
  constructor (
    private readonly options: ConstructorParameters<typeof AbstractUserExporter<VideoExportJSON>>[0] & {
      withVideoFiles: boolean
    }
  ) {
    super(options)
  }

  async export () {
    const videosJSON: VideoExportJSON['videos'] = []
    const activityPubOutbox: ActivityCreate<VideoObject>[] = []
    let staticFiles: ExportResult<VideoExportJSON>['staticFiles'] = []

    let videoIds: number[] = []
    let start = 0
    const chunkSize = 100

    do {
      videoIds = await VideoModel.getAllIdsByAccount({ account: this.user.Account, start, count: chunkSize })
      start += videoIds.length

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
    } while (videoIds.length === chunkSize)

    return {
      json: { videos: sortBy(videosJSON, 'publishedAt') },
      activityPubOutbox,
      staticFiles
    }
  }

  private async exportVideo (videoId: number) {
    const [ video, captions, source, chapters, playerSettings ] = await Promise.all([
      VideoModel.loadFull(videoId),
      VideoCaptionModel.listVideoCaptions(videoId),
      VideoSourceModel.loadLatest(videoId),
      VideoChapterModel.listChaptersOfVideo(videoId),
      PlayerSettingModel.loadByVideoId(videoId)
    ])

    const passwords = video.privacy === VideoPrivacy.PASSWORD_PROTECTED
      ? (await VideoPasswordModel.listPasswords({ videoId, start: 0, count: undefined, sort: 'createdAt' })).data
      : []

    const live = video.isLive
      ? await VideoLiveModel.loadByVideoIdFull(videoId)
      : undefined // We already have captions, so we can set it to the video object
    ;(video as any).VideoCaptions = captions
    // Then fetch more attributes for AP serialization
    const videoAP = await video.lightAPToFullAP(undefined)

    const { relativePathsFromJSON, staticFiles, exportedVideoFileOrSource } = await this.exportVideoFiles({ video, captions })

    return {
      json: this.exportVideoJSON({
        video,
        captions,
        live,
        passwords,
        source,
        chapters,
        playerSettings,
        archiveFiles: relativePathsFromJSON
      }),
      staticFiles,
      relativePathsFromJSON,
      activityPubOutbox: await this.exportVideoAP(videoAP, chapters, exportedVideoFileOrSource)
    }
  }

  // ---------------------------------------------------------------------------

  private exportVideoJSON (options: {
    video: MVideoFullLight
    captions: MVideoCaption[]
    live: MVideoLiveWithSettingSchedules
    passwords: MVideoPassword[]
    source: MVideoSource
    playerSettings: MPlayerSetting
    chapters: MVideoChapter[]
    archiveFiles: VideoExportJSON['videos'][0]['archiveFiles']
  }): VideoExportJSON['videos'][0] {
    const { video, captions, live, passwords, source, chapters, playerSettings, archiveFiles } = options

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

      commentsPolicy: video.commentsPolicy,

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

      source: this.exportVideoSourceJSON(source),

      playerSettings: this.exportPlayerSettingsJSON(playerSettings),

      archiveFiles
    }
  }

  private exportLiveJSON (video: MVideo, live: MVideoLiveWithSettingSchedules) {
    if (!video.isLive) return undefined

    return {
      saveReplay: live.saveReplay,
      permanentLive: live.permanentLive,
      latencyMode: live.latencyMode,
      streamKey: live.streamKey,

      replaySettings: live.ReplaySetting
        ? { privacy: live.ReplaySetting.privacy }
        : undefined,

      schedules: live.LiveSchedules?.map(s => ({
        startAt: s.startAt.toISOString()
      }))
    }
  }

  private exportCaptionsJSON (video: MVideo, captions: MVideoCaption[]) {
    return captions.map(c => ({
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      language: c.language,
      filename: c.filename,
      automaticallyGenerated: c.automaticallyGenerated,
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
      segmentsSha256Url: p.getSha256SegmentsUrl(video),
      files: this.exportFilesJSON(video, p.VideoFiles)
    }))
  }

  private exportVideoSourceJSON (source: MVideoSource) {
    if (!source) return null

    return {
      inputFilename: source.inputFilename,

      resolution: source.resolution,
      size: source.size,

      width: source.width,
      height: source.height,

      fps: source.fps,

      metadata: source.metadata
    }
  }

  private exportPlayerSettingsJSON (playerSettings: MPlayerSetting) {
    if (!playerSettings) return null

    return {
      theme: playerSettings.theme
    }
  }

  // ---------------------------------------------------------------------------

  private async exportVideoAP (
    video: MVideoAP,
    chapters: MVideoChapter[],
    exportedVideoFileOrSource: MVideoFile | MVideoSource
  ): Promise<ActivityCreate<VideoObject>> {
    const icon = video.getPreview()

    const audience = getVideoAudience(video.VideoChannel.Account.Actor, video.privacy, { skipPrivacyCheck: true })
    const videoObject: VideoObject = {
      ...audiencify(await video.toActivityPubObject(), audience),

      icon: [
        {
          ...icon.toActivityPubObject(video),

          url: join(this.options.relativeStaticDirPath, this.getArchiveThumbnailFilePath(video, icon))
        }
      ],

      subtitleLanguage: video.VideoCaptions.map(c => ({
        ...c.toActivityPubObject(video),

        url: [
          {
            mediaType: 'text/vtt',
            type: 'Link',
            href: join(this.options.relativeStaticDirPath, this.getArchiveCaptionFilePath(video, c))
          }
        ]
      })),

      hasParts: buildChaptersAPHasPart(video, chapters),

      attachment: this.options.withVideoFiles && exportedVideoFileOrSource
        ? [
          {
            type: 'Video' as 'Video',
            url: join(this.options.relativeStaticDirPath, this.getArchiveVideoFilePath(video, exportedVideoFileOrSource)),

            // FIXME: typings
            ...pick((exportedVideoFileOrSource as MVideoFile & MVideoSource).toActivityPubObject(video), [
              'mediaType',
              'height',
              'size',
              'fps'
            ])
          }
        ]
        : undefined
    }

    return buildCreateActivity(video.url, video.VideoChannel.Account.Actor, videoObject, audience)
  }

  // ---------------------------------------------------------------------------

  private async exportVideoFiles (options: {
    video: MVideoFullLight
    captions: MVideoCaption[]
  }) {
    const { video, captions } = options

    const staticFiles: ExportResult<VideoExportJSON>['staticFiles'] = []

    let exportedVideoFileOrSource: MVideoFile | MVideoSource

    const relativePathsFromJSON = {
      videoFile: null as string,
      thumbnail: null as string,
      captions: {} as { [lang: string]: string }
    }

    if (this.options.withVideoFiles) {
      const { source, videoFile, separatedAudioFile } = await this.getArchiveVideo(video)

      if (source || videoFile || separatedAudioFile) {
        const videoPath = this.getArchiveVideoFilePath(video, source || videoFile || separatedAudioFile)

        staticFiles.push({
          archivePath: videoPath,

          // Prefer using original file if possible
          readStreamFactory: () =>
            source?.keptOriginalFilename
              ? this.generateVideoSourceReadStream(source)
              : this.generateVideoFileReadStream({ video, videoFile, separatedAudioFile })
        })

        relativePathsFromJSON.videoFile = join(this.relativeStaticDirPath, videoPath)

        exportedVideoFileOrSource = source?.keptOriginalFilename
          ? source
          : videoFile || separatedAudioFile
      }
    }

    for (const caption of captions) {
      staticFiles.push({
        archivePath: this.getArchiveCaptionFilePath(video, caption),
        readStreamFactory: () => this.generateCaptionReadStream(caption)
      })

      relativePathsFromJSON.captions[caption.language] = join(this.relativeStaticDirPath, this.getArchiveCaptionFilePath(video, caption))
    }

    const thumbnail = video.getPreview() || video.getMiniature()
    if (thumbnail) {
      staticFiles.push({
        archivePath: this.getArchiveThumbnailFilePath(video, thumbnail),
        readStreamFactory: () => Promise.resolve(createReadStream(thumbnail.getPath()))
      })

      relativePathsFromJSON.thumbnail = join(this.relativeStaticDirPath, this.getArchiveThumbnailFilePath(video, thumbnail))
    }

    return { staticFiles, relativePathsFromJSON, exportedVideoFileOrSource }
  }

  private async generateVideoSourceReadStream (source: MVideoSource): Promise<Readable> {
    if (source.storage === FileStorage.FILE_SYSTEM) {
      return createReadStream(VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename))
    }

    const { stream } = await getOriginalFileReadStream({ keptOriginalFilename: source.keptOriginalFilename, rangeHeader: undefined })

    return stream
  }

  private async generateVideoFileReadStream (options: {
    videoFile: MVideoFile
    separatedAudioFile: MVideoFile
    video: MVideoFullLight
  }): Promise<Readable> {
    const { video, videoFile, separatedAudioFile } = options

    if (separatedAudioFile) {
      const stream = new PassThrough()

      new VideoDownload({ video, videoFiles: [ videoFile, separatedAudioFile ] })
        .muxToMergeVideoFiles(stream)
        .catch(err => logger.error('Cannot mux video files', { err }))

      return Promise.resolve(stream)
    }

    if (videoFile.storage === FileStorage.FILE_SYSTEM) {
      return createReadStream(VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile))
    }

    const { stream } = videoFile.isHLS()
      ? await getHLSFileReadStream({ playlist: video.getHLSPlaylist(), filename: videoFile.filename, rangeHeader: undefined })
      : await getWebVideoFileReadStream({ filename: videoFile.filename, rangeHeader: undefined })

    return stream
  }

  private async generateCaptionReadStream (caption: MVideoCaption): Promise<Readable> {
    if (caption.storage === FileStorage.FILE_SYSTEM) {
      return createReadStream(caption.getFSFilePath())
    }

    const { stream } = await getCaptionReadStream({ filename: caption.filename, rangeHeader: undefined })

    return stream
  }

  // ---------------------------------------------------------------------------

  private async getArchiveVideo (video: MVideoFullLight) {
    const source = await VideoSourceModel.loadLatest(video.id)

    const { videoFile, separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()

    if (source?.keptOriginalFilename) return { source }

    return { videoFile, separatedAudioFile }
  }

  private getArchiveVideoFilePath (video: MVideo, file: { keptOriginalFilename?: string, filename?: string }) {
    return join('video-files', video.uuid + extname(file.keptOriginalFilename || file.filename))
  }

  private getArchiveCaptionFilePath (video: MVideo, caption: MVideoCaptionLanguageUrl) {
    return join('captions', video.uuid + '-' + caption.language + extname(caption.filename))
  }

  private getArchiveThumbnailFilePath (video: MVideo, thumbnail: MThumbnail) {
    return join('thumbnails', video.uuid + extname(thumbnail.filename))
  }
}
