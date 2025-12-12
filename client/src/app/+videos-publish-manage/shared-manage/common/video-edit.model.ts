import { getOriginUrl } from '@app/helpers'
import { exists, omit, pick, secondsToTime } from '@peertube/peertube-core-utils'
import {
  HTMLServerConfig,
  LiveVideo,
  LiveVideoCreate,
  LiveVideoUpdate,
  NSFWFlag,
  PlayerVideoSettings,
  PlayerVideoSettingsUpdate,
  VideoCaption,
  VideoChapter,
  VideoCreate,
  VideoDetails,
  VideoImportCreate,
  VideoPrivacy,
  VideoPrivacyType,
  VideoScheduleUpdate,
  VideoSource,
  VideoState,
  VideoStateType,
  VideoStudioTask,
  VideoStudioTaskCut,
  VideoUpdate
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { Jsonify, SharedUnionFieldsDeep } from 'type-fest'
import { VideoCaptionWithPathEdit } from './video-caption-edit.model'
import { VideoChaptersEdit } from './video-chapters-edit.model'
import { AuthUser } from '@app/core'

const debugLogger = debug('peertube:video-manage:video-edit')

export type VideoEditPrivacyType = VideoPrivacyType

type CommonUpdateForm =
  & Omit<
    VideoUpdate,
    'privacy' | 'videoPasswords' | 'thumbnailfile' | 'scheduleUpdate' | 'originallyPublishedAt' | 'nsfwFlags'
  >
  & {
    schedulePublicationAt?: Date
    originallyPublishedAt?: Date
    privacy?: VideoEditPrivacyType
    videoPassword?: string

    nsfwFlagViolent?: boolean
    nsfwFlagSex?: boolean
  }

type LiveUpdateForm = Omit<LiveVideoUpdate, 'replaySettings' | 'schedules'> & {
  replayPrivacy?: VideoPrivacyType
  liveStreamKey?: string
  schedules?: {
    startAt?: Date
  }[]
}

type ReplaceFileForm = {
  replaceFile?: File
}

type StudioForm = {
  'cut'?: { start?: number, end?: number }
  'add-intro'?: { file?: File }
  'add-outro'?: { file?: File }
  'add-watermark'?: { file?: File }
}

type PlayerSettingsForm = PlayerVideoSettingsUpdate

// ---------------------------------------------------------------------------

type LoadFromPublishOptions = Required<Pick<VideoCreate, 'channelId' | 'support'>> & Partial<Pick<VideoCreate, 'name'>> & {
  user: AuthUser
}

type CreateFromUploadOptions = LoadFromPublishOptions & Required<Pick<VideoCreate, 'name'>>

type CreateFromImportOptions = LoadFromPublishOptions & Pick<VideoImportCreate, 'magnetUri' | 'torrentfile' | 'targetUrl'>

type CreateFromLiveOptions =
  & CreateFromUploadOptions
  & Required<Pick<LiveVideoCreate, 'permanentLive' | 'latencyMode' | 'saveReplay' | 'replaySettings' | 'schedules'>>

type UpdateFromAPIOptions = {
  video?: Pick<
    VideoDetails,
    | 'id'
    | 'uuid'
    | 'shortUUID'
    | 'name'
    | 'channel'
    | 'privacy'
    | 'category'
    | 'licence'
    | 'language'
    | 'description'
    | 'tags'
    | 'nsfw'
    | 'nsfwFlags'
    | 'nsfwSummary'
    | 'waitTranscoding'
    | 'support'
    | 'commentsPolicy'
    | 'downloadEnabled'
    | 'pluginData'
    | 'scheduledUpdate'
    | 'originallyPublishedAt'
    | 'duration'
    | 'likes'
    | 'aspectRatio'
    | 'views'
    | 'blacklisted'
    | 'previewPath'
    | 'state'
    | 'isLive'
  >
  live?: LiveVideo
  chapters?: VideoChapter[]
  captions?: VideoCaption[]
  videoPasswords?: string[]
  videoSource?: VideoSource
  playerSettings: PlayerVideoSettings
}

// ---------------------------------------------------------------------------

type CommonUpdate = Omit<VideoUpdate, 'thumbnailfile' | 'originallyPublishedAt' | 'scheduleUpdate'> & {
  originallyPublishedAt?: string
  scheduleUpdate?: {
    updateAt: string
    privacy?: VideoScheduleUpdate['privacy']
  }
}

type LiveUpdate = Omit<LiveVideoUpdate, 'schedules'> & {
  schedules?: {
    startAt: string
  }[]
}

export class VideoEdit {
  private isNewVideo = false
  private common: CommonUpdate = {}
  private captions: VideoCaptionWithPathEdit[] = []
  private chapters: VideoChaptersEdit = new VideoChaptersEdit()
  private live: LiveUpdate
  private replaceFile: File
  private studioTasks: VideoStudioTask[] = []
  private playerSettings: PlayerVideoSettings

  private videoImport: Pick<VideoImportCreate, 'magnetUri' | 'torrentfile' | 'targetUrl'>

  private metadata: Partial<{
    id: number
    uuid: string
    shortUUID: string
    state: VideoStateType
    isLive: boolean
    views: number
    aspectRatio: number
    duration: number
    likes: number
    blacklisted: boolean

    ownerAccountId: number
    ownerAccountDisplayName: string

    live: Pick<LiveVideo, 'rtmpUrl' | 'rtmpsUrl' | 'streamKey'>
    videoSource: VideoSource
  }> = {}

  private videoAttributes: {
    id: number
    shortUUID: string
    uuid: string
    name: string
    state: VideoStateType
    privacy: VideoEditPrivacyType
    isLive: boolean
    aspectRatio: number
    duration: number
    views: number
    likes: number

    blacklisted: boolean

    ownerAccountId: number
    ownerAccountDisplayName: string

    live?: Pick<LiveVideo, 'rtmpUrl' | 'rtmpsUrl' | 'streamKey'>
  }

  private saveStore: {
    common?: Omit<CommonUpdate, 'pluginData' | 'previewfile'>
    previewfile?: { size: number }

    live?: LiveUpdate
    playerSettings?: PlayerVideoSettings

    pluginData?: any
    pluginDefaults?: Record<string, string | boolean>
  } = {}
  private checkPluginChanges = false

  private serverConfig: HTMLServerConfig

  private constructor (serverConfig: HTMLServerConfig, isNewVideo = false) {
    this.serverConfig = serverConfig
    this.isNewVideo = isNewVideo
  }

  // ---------------------------------------------------------------------------

  static createFromUpload (serverConfig: HTMLServerConfig, options: CreateFromUploadOptions) {
    const videoEdit = new VideoEdit(serverConfig, true)
    videoEdit.loadFromPublish(options, false)

    return videoEdit
  }

  // ---------------------------------------------------------------------------

  static createFromImport (serverConfig: HTMLServerConfig, options: CreateFromImportOptions) {
    const videoEdit = new VideoEdit(serverConfig, true)
    videoEdit.loadFromImport(options)

    return videoEdit
  }

  private loadFromImport (options: CreateFromImportOptions) {
    this.loadFromPublish(options, false)

    this.videoImport = {
      targetUrl: options.targetUrl,
      magnetUri: options.magnetUri,
      torrentfile: options.torrentfile
    }

    this.updateAfterChange()
  }

  // ---------------------------------------------------------------------------

  static createFromLive (serverConfig: HTMLServerConfig, options: CreateFromLiveOptions) {
    const videoEdit = new VideoEdit(serverConfig, true)
    videoEdit.loadFromLive(options)

    return videoEdit
  }

  private loadFromLive (options: CreateFromLiveOptions) {
    this.loadFromPublish(options, true)

    this.live = {
      latencyMode: options.latencyMode,
      permanentLive: options.permanentLive,

      saveReplay: options.saveReplay,

      replaySettings: options.replaySettings
        ? { privacy: options.replaySettings.privacy }
        : undefined,

      schedules: options.schedules
        ? options.schedules.map(s => ({ startAt: new Date(s.startAt).toISOString() }))
        : undefined
    }

    this.updateAfterChange()
  }

  // ---------------------------------------------------------------------------

  private loadFromPublish (options: LoadFromPublishOptions, isLive: boolean) {
    const serverDefaults = this.serverConfig.defaults

    this.common.name = options.name
    this.common.channelId = options.channelId
    this.common.support = options.support
    this.metadata.isLive = isLive

    this.common.privacy = serverDefaults.publish.privacy
    this.common.downloadEnabled = serverDefaults.publish.downloadEnabled
    this.common.licence = serverDefaults.publish.licence
    this.common.commentsPolicy = serverDefaults.publish.commentsPolicy
    this.common.nsfw = this.serverConfig.instance.isNSFW

    this.common.waitTranscoding = true
    this.common.tags = []
    this.common.pluginData = {}

    this.metadata.views = 0
    this.metadata.likes = 0

    this.metadata.ownerAccountDisplayName = options.user.account.displayName
    this.metadata.ownerAccountId = options.user.account.id

    this.updateAfterChange()
  }

  // ---------------------------------------------------------------------------

  static async createFromAPI (serverConfig: HTMLServerConfig, options: UpdateFromAPIOptions) {
    const videoEdit = new VideoEdit(serverConfig)
    await videoEdit.loadFromAPI(options)

    return videoEdit
  }

  async loadFromAPI (options: UpdateFromAPIOptions & { loadPrivacy?: boolean }) {
    const { video, videoPasswords, live, chapters, captions, videoSource, playerSettings, loadPrivacy = true } = options

    debugLogger('Load from API', options)

    this.loadVideo({ video, videoPasswords, saveInStore: true, loadPrivacy })
    this.loadLive(live)
    this.loadPlayerSettings(playerSettings)

    if (captions !== undefined) {
      this.captions = captions
    }

    if (chapters !== undefined) {
      this.chapters = new VideoChaptersEdit()
      if (chapters) this.chapters.loadFromAPI(chapters)
    }

    if (videoSource !== undefined) {
      this.metadata.videoSource = videoSource
    }

    await this.loadPreview(video)

    this.updateAfterChange()
  }

  private loadVideo (options: {
    video: UpdateFromAPIOptions['video']
    videoPasswords?: string[]
    loadPrivacy?: boolean // default true
    saveInStore: boolean
  }) {
    const { video, saveInStore, loadPrivacy = true, videoPasswords = [] } = options

    if (video === undefined) return

    const buildObj: (options: { loadPrivacy: boolean }) => CommonUpdate = () => {
      const { loadPrivacy } = options

      const base = {
        ...this.common,

        name: video.name || '',

        channelId: video.channel?.id ?? null,
        category: video.category?.id ?? null,
        licence: video.licence?.id ?? null,
        language: video.language?.id ?? null,
        description: video.description ?? '',
        tags: video.tags ?? [],
        nsfw: video.nsfw ?? null,
        nsfwSummary: video.nsfwSummary ?? null,
        nsfwFlags: video.nsfwFlags ?? NSFWFlag.NONE,
        waitTranscoding: video.waitTranscoding ?? null,
        support: video.support ?? '',
        commentsPolicy: video.commentsPolicy?.id ?? null,

        downloadEnabled: video.downloadEnabled ?? null,

        pluginData: video.pluginData ?? {},

        scheduleUpdate: video.scheduledUpdate
          ? { updateAt: new Date(video.scheduledUpdate.updateAt).toISOString(), privacy: video.scheduledUpdate.privacy }
          : null,

        originallyPublishedAt: video.originallyPublishedAt
          ? new Date(video.originallyPublishedAt).toISOString()
          : null,

        videoPasswords: videoPasswords ?? []
      }

      if (loadPrivacy) {
        return { ...base, privacy: video.privacy?.id ?? null }
      }

      return base
    }

    this.common = buildObj({ loadPrivacy })

    if (saveInStore) {
      const obj = buildObj({ loadPrivacy: true })
      this.saveStore.common = omit(obj, [ 'pluginData', 'previewfile' ])

      // Apply plugin defaults so we correctly detect changes
      const pluginDefaults = this.saveStore.pluginDefaults || {}
      this.saveStore.pluginData = { ...pluginDefaults, ...obj.pluginData }
    }

    // ---------------------------------------------------------------------------

    this.metadata.id = video.id
    this.metadata.uuid = video.uuid
    this.metadata.shortUUID = video.shortUUID

    this.metadata.state = video.state.id
    this.metadata.duration = video.duration
    this.metadata.views = video.views
    this.metadata.likes = video.likes
    this.metadata.aspectRatio = video.aspectRatio
    this.metadata.blacklisted = video.blacklisted

    this.metadata.isLive = video.isLive

    this.metadata.ownerAccountDisplayName = video.channel.ownerAccount.displayName
    this.metadata.ownerAccountId = video.channel.ownerAccount.id
  }

  loadPluginDataDefaults (pluginDefaults: Record<string, string | boolean>) {
    this.saveStore.pluginDefaults = pluginDefaults

    if (this.saveStore?.pluginData) {
      this.saveStore.pluginData = { ...this.saveStore.pluginDefaults, ...this.saveStore.pluginData }
    }
  }

  private async loadPreview (video: UpdateFromAPIOptions['video']) {
    if (!video?.previewPath) return

    try {
      const response = await fetch(getOriginUrl() + video.previewPath)

      this.common.previewfile = await response.blob()
      this.saveStore.previewfile = { size: this.common.previewfile.size }
    } catch (err) {
      logger.error('Failed to fetch video preview', err)
    }
  }

  private loadLive (live: UpdateFromAPIOptions['live']) {
    if (live === undefined) {
      this.metadata.isLive = false
      return
    }

    const buildObj = () => {
      return {
        permanentLive: live.permanentLive,
        latencyMode: live.latencyMode,
        saveReplay: live.saveReplay,

        replaySettings: live.replaySettings
          ? { privacy: live.replaySettings.privacy }
          : undefined,

        schedules: live.schedules
          ? live.schedules.map(s => ({ startAt: new Date(s.startAt).toISOString() }))
          : undefined
      }
    }

    this.metadata.isLive = true
    this.live = buildObj()
    this.saveStore.live = buildObj()

    this.metadata.live = pick(live, [ 'rtmpUrl', 'rtmpsUrl', 'streamKey' ])
  }

  private loadPlayerSettings (playerSettings: UpdateFromAPIOptions['playerSettings']) {
    const buildObj = () => {
      return {
        theme: playerSettings.theme
      }
    }

    this.playerSettings = buildObj()
    this.saveStore.playerSettings = buildObj()
  }

  loadAfterPublish (options: {
    video: Pick<VideoDetails, 'id' | 'uuid' | 'shortUUID'>
  }) {
    this.metadata.id = options.video.id
    this.metadata.uuid = options.video.uuid
    this.metadata.shortUUID = options.video.shortUUID

    this.updateAfterChange()
  }

  // ---------------------------------------------------------------------------

  loadFromCommonForm (values: CommonUpdateForm) {
    if (values.name !== undefined) this.common.name = values.name
    if (values.channelId !== undefined) this.common.channelId = values.channelId
    if (values.category !== undefined) this.common.category = values.category
    if (values.licence !== undefined) this.common.licence = values.licence
    if (values.language !== undefined) this.common.language = values.language
    if (values.description !== undefined) this.common.description = values.description
    if (values.tags !== undefined) this.common.tags = values.tags
    if (values.waitTranscoding !== undefined) this.common.waitTranscoding = values.waitTranscoding
    if (values.support !== undefined) this.common.support = values.support
    if (values.commentsPolicy !== undefined) this.common.commentsPolicy = values.commentsPolicy
    if (values.downloadEnabled !== undefined) this.common.downloadEnabled = values.downloadEnabled
    if (values.previewfile !== undefined) this.common.previewfile = values.previewfile
    if (values.pluginData !== undefined) this.common.pluginData = values.pluginData

    // ---------------------------------------------------------------------------
    // NSFW
    // ---------------------------------------------------------------------------

    if (values.nsfw !== undefined) this.common.nsfw = values.nsfw

    if (this.common.nsfw) {
      if (values.nsfwFlagSex !== undefined) {
        this.common.nsfwFlags = values.nsfwFlagSex
          ? this.common.nsfwFlags | NSFWFlag.EXPLICIT_SEX
          : this.common.nsfwFlags & ~NSFWFlag.EXPLICIT_SEX
      }

      if (values.nsfwFlagViolent !== undefined) {
        this.common.nsfwFlags = values.nsfwFlagViolent
          ? this.common.nsfwFlags | NSFWFlag.VIOLENT
          : this.common.nsfwFlags & ~NSFWFlag.VIOLENT
      }

      if (values.nsfwSummary !== undefined) {
        this.common.nsfwSummary = values.nsfwSummary
      }
    } else {
      this.common.nsfwSummary = null
      this.common.nsfwFlags = NSFWFlag.NONE
    }

    // ---------------------------------------------------------------------------

    if (values.videoPassword !== undefined) {
      this.common.videoPasswords = values.privacy === VideoPrivacy.PASSWORD_PROTECTED && values.videoPassword
        ? [ values.videoPassword ]
        : []
    }

    if (values.privacy !== undefined) {
      if (values.privacy === VideoPrivacy.PREMIERE && values.schedulePublicationAt) {
        const updateAt = new Date(values.schedulePublicationAt)
        updateAt.setSeconds(0)

        this.common.privacy = VideoPrivacy.PREMIERE

        this.common.scheduleUpdate = {
          updateAt: values.schedulePublicationAt
            ? updateAt.toISOString()
            : undefined,
          privacy: VideoPrivacy.PUBLIC
        }
      } else {
        this.common.privacy = values.privacy
        this.common.scheduleUpdate = null
      }
    }

    // Convert originallyPublishedAt to string so that function objectToFormData() works correctly
    if (values.originallyPublishedAt !== undefined) {
      this.common.originallyPublishedAt = values.originallyPublishedAt
        ? new Date(values.originallyPublishedAt).toISOString()
        : null
    }

    this.updateAfterChange()
  }

  toCommonFormPatch () {
    const json: Required<CommonUpdateForm> = {
      category: this.common.category,
      licence: this.common.licence,
      language: this.common.language,
      description: this.common.description,
      support: this.common.support,
      name: this.common.name,
      tags: this.common.tags,

      nsfw: this.common.nsfw,
      nsfwFlagSex: (this.common.nsfwFlags & NSFWFlag.EXPLICIT_SEX) === NSFWFlag.EXPLICIT_SEX,
      nsfwFlagViolent: (this.common.nsfwFlags & NSFWFlag.VIOLENT) === NSFWFlag.VIOLENT,
      nsfwSummary: this.common.nsfwSummary,

      commentsPolicy: this.common.commentsPolicy,
      waitTranscoding: this.common.waitTranscoding,
      channelId: this.common.channelId,
      privacy: this.common.privacy,

      pluginData: this.common.pluginData,

      previewfile: this.common.previewfile,

      videoPassword: this.common.videoPasswords && this.common.videoPasswords.length !== 0
        ? this.common.videoPasswords[0]
        : null,

      downloadEnabled: this.common.downloadEnabled,

      originallyPublishedAt: this.common.originallyPublishedAt
        ? new Date(this.common.originallyPublishedAt)
        : null,

      schedulePublicationAt: undefined
    }

    // Special case if we scheduled an update
    if (this.common.scheduleUpdate) {
      Object.assign(json, {
        privacy: this.common.scheduleUpdate.privacy,
        schedulePublicationAt: new Date(this.common.scheduleUpdate.updateAt.toString())
      })
    }

    return json
  }

  toVideoUpdate (): Required<VideoUpdate> {
    return {
      ...this.toVideoCreateOrUpdate(),

      pluginData: this.common.pluginData
    }
  }

  toVideoCreate (overriddenPrivacy: VideoPrivacyType): Required<Omit<VideoCreate, 'generateTranscription'>> {
    return {
      ...this.toVideoCreateOrUpdate(),

      privacy: overriddenPrivacy
    }
  }

  private toVideoCreateOrUpdate (): Required<SharedUnionFieldsDeep<VideoCreate | VideoUpdate>> {
    return {
      name: this.common.name,
      category: this.common.category || null,
      licence: this.common.licence || null,
      language: this.common.language || null,
      support: this.common.support || null,
      description: this.common.description || null,
      channelId: this.common.channelId,
      privacy: this.common.privacy,

      videoPasswords: this.common.privacy === VideoPrivacy.PASSWORD_PROTECTED
        ? this.common.videoPasswords
        : undefined,

      tags: this.common.tags,
      nsfw: this.common.nsfw,
      nsfwFlags: this.common.nsfwFlags,
      nsfwSummary: this.common.nsfwSummary || null,
      waitTranscoding: this.common.waitTranscoding,
      commentsPolicy: this.common.commentsPolicy,
      downloadEnabled: this.common.downloadEnabled,
      thumbnailfile: this.common.previewfile,
      previewfile: this.common.previewfile,
      scheduleUpdate: this.common.scheduleUpdate || null,
      originallyPublishedAt: this.common.originallyPublishedAt || null
    }
  }

  // ---------------------------------------------------------------------------

  loadFromLiveForm (values: LiveUpdateForm) {
    if (values.permanentLive !== undefined) this.live.permanentLive = values.permanentLive
    if (values.latencyMode !== undefined) this.live.latencyMode = values.latencyMode
    if (values.saveReplay !== undefined) this.live.saveReplay = values.saveReplay

    if (values.replayPrivacy !== undefined) {
      this.live.replaySettings = values.replayPrivacy
        ? { privacy: values.replayPrivacy }
        : undefined
    }

    if (values.schedules !== undefined) {
      if (values.schedules === null || values.schedules.length === 0 || !values.schedules[0].startAt) {
        this.live.schedules = []
      } else {
        this.live.schedules = values.schedules.map(s => ({
          startAt: new Date(s.startAt).toISOString()
        }))
      }
    }

    this.updateAfterChange()
  }

  toLiveFormPatch (): Required<LiveUpdateForm> {
    return {
      liveStreamKey: this.metadata.live.streamKey,
      permanentLive: this.live.permanentLive,
      latencyMode: this.live.latencyMode,
      saveReplay: this.live.saveReplay,

      replayPrivacy: this.live.replaySettings
        ? this.live.replaySettings.privacy
        : VideoPrivacy.PRIVATE,

      schedules: this.live.schedules?.map(s => ({
        startAt: new Date(s.startAt)
      }))
    }
  }

  toLiveUpdate (): LiveVideoUpdate {
    return {
      permanentLive: this.live.permanentLive,
      saveReplay: this.live.saveReplay,
      replaySettings: this.live.saveReplay
        ? this.live.replaySettings
        : undefined,
      latencyMode: this.live.latencyMode,

      schedules: this.live.schedules
    }
  }

  toLiveCreate (overriddenPrivacy: VideoPrivacyType): LiveVideoCreate {
    return {
      ...this.toVideoCreate(overriddenPrivacy),

      permanentLive: this.live.permanentLive,
      latencyMode: this.live.latencyMode,
      saveReplay: this.live.saveReplay,
      replaySettings: this.live.replaySettings,
      schedules: this.live.schedules
    }
  }

  // ---------------------------------------------------------------------------

  toVideoImportCreate (overriddenPrivacy: VideoPrivacyType): VideoImportCreate {
    const base: VideoImportCreate = this.toVideoCreate(overriddenPrivacy)

    if (this.videoImport.targetUrl) base.targetUrl = this.videoImport.targetUrl
    if (this.videoImport.magnetUri) base.magnetUri = this.videoImport.magnetUri
    if (this.videoImport.torrentfile) base.torrentfile = this.videoImport.torrentfile

    return base
  }

  // ---------------------------------------------------------------------------

  loadFromReplaceFileForm (values: ReplaceFileForm) {
    this.replaceFile = values.replaceFile

    this.updateAfterChange()
  }

  toReplaceFileFormPatch (): Required<ReplaceFileForm> {
    return { replaceFile: this.replaceFile }
  }

  resetReplaceFile () {
    this.replaceFile = undefined
  }

  // ---------------------------------------------------------------------------

  loadFromStudioForm (values: StudioForm) {
    const duration = this.getVideoAttributes().duration
    this.studioTasks = []

    const cut = values.cut
    if ((exists(cut.start) && cut.start !== 0) || (exists(cut.end) && cut.end !== duration)) {
      const options: VideoStudioTaskCut['options'] = {}

      if (exists(cut.start) && cut.start !== 0) options.start = cut.start
      if (exists(cut.end) && cut.end !== duration) options.end = cut.end

      this.studioTasks.push({ name: 'cut', options })
    }

    if (values['add-intro']?.['file']) {
      this.studioTasks.push({
        name: 'add-intro',
        options: {
          file: values['add-intro']['file']
        }
      })
    }

    if (values['add-outro']?.['file']) {
      this.studioTasks.push({
        name: 'add-outro',
        options: {
          file: values['add-outro']['file']
        }
      })
    }

    if (values['add-watermark']?.['file']) {
      this.studioTasks.push({
        name: 'add-watermark',
        options: {
          file: values['add-watermark']['file']
        }
      })
    }
  }

  toStudioFormPatch (): Required<StudioForm> {
    const cut = this.studioTasks.find(t => t.name === 'cut')
    const addIntro = this.studioTasks.find(t => t.name === 'add-intro')
    const addOutro = this.studioTasks.find(t => t.name === 'add-outro')
    const addWatermark = this.studioTasks.find(t => t.name === 'add-watermark')

    return {
      'cut': {
        start: cut?.options?.start ?? 0,
        end: cut?.options?.end ?? this.metadata.duration
      },
      'add-intro': { file: addIntro?.options?.file as File ?? null },
      'add-outro': { file: addOutro?.options?.file as File },
      'add-watermark': { file: addWatermark?.options?.file as File }
    }
  }

  resetStudio () {
    this.studioTasks = []
  }

  // ---------------------------------------------------------------------------

  loadFromPlayerSettingsForm (values: PlayerSettingsForm) {
    this.playerSettings = values
  }

  toPlayerSettingsFormPatch (): Required<PlayerSettingsForm> {
    return {
      theme: this.playerSettings?.theme ?? 'channel-default'
    }
  }

  toPlayerSettingsUpdate (): PlayerVideoSettingsUpdate {
    if (!this.playerSettings) return undefined

    return {
      theme: this.playerSettings.theme
    }
  }

  // ---------------------------------------------------------------------------

  getVideoSource () {
    return this.metadata.videoSource
  }

  getLive () {
    return this.metadata.live
  }

  getVideoAttributes () {
    return this.videoAttributes
  }

  getChaptersEdit () {
    return this.chapters
  }

  getReplaceFile (): File {
    return this.replaceFile
  }

  getCaptionsEdit () {
    return this.captions
  }

  getStudioTasks () {
    return this.studioTasks
  }

  getPlayerSettings () {
    return this.playerSettings
  }

  getStudioTasksSummary () {
    return this.getStudioTasks().map(t => {
      if (t.name === 'add-intro') {
        return $localize`"${(t.options.file as File).name}" will be added at the beginning of the video`
      }

      if (t.name === 'add-outro') {
        return $localize`"${(t.options.file as File).name}" will be added at the end of the video`
      }

      if (t.name === 'add-watermark') {
        return $localize`"${(t.options.file as File).name}" image watermark will be added to the video`
      }

      if (t.name === 'cut') {
        const { start, end } = t.options

        if (start !== undefined && end !== undefined) {
          return $localize`Video will begin at ${secondsToTime(start)} and stop at ${secondsToTime(end)}`
        }

        if (start !== undefined) {
          return $localize`Video will begin at ${secondsToTime(start)}`
        }

        if (end !== undefined) {
          return $localize`Video will stop at ${secondsToTime(end)}`
        }
      }

      return ''
    })
  }

  // ---------------------------------------------------------------------------

  hasCommonChanges () {
    if (this.isNewVideo) return true
    if (!this.saveStore.common) return true

    let changes = !this.areSameObjects(omit(this.common, [ 'previewfile', 'pluginData' ]), this.saveStore.common)

    // Compare preview file
    if (changes !== true && (this.common.previewfile || this.saveStore.previewfile)) {
      changes = this.common.previewfile?.size !== this.saveStore.previewfile?.size
    }

    debugLogger('Check if has common changes', {
      changes,
      common: this.common,
      saveCommon: this.saveStore.common,
      savePreview: this.saveStore.previewfile
    })

    return changes
  }

  hasPluginDataChanges () {
    if (!this.checkPluginChanges) return false
    if (!this.saveStore.pluginData) return true

    const current = this.common.pluginData
    const changes = !this.areSameObjects(current, this.saveStore.pluginData)

    debugLogger('Check if has plugin data changes', {
      changes,
      pluginData: current,
      savePluginData: this.saveStore.pluginData
    })

    return changes
  }

  hasCaptionChanges () {
    const changes = this.captions.some(caption => !!caption.action)

    debugLogger('Check if caption has changes', { captions: this.captions, changes })

    return changes
  }

  hasChaptersChanges () {
    const changes = this.chapters.hasChanges()

    debugLogger('Check if chapters has changes', { chapters: this.chapters, changes })

    return changes
  }

  hasLiveChanges () {
    if (!this.live) return false
    if (!this.saveStore.live) return true

    const changes = !this.areSameObjects(this.live, this.saveStore.live)

    debugLogger('Check if live has changes', { live: this.live, saveLive: this.saveStore.live, changes })

    return changes
  }

  hasReplaceFile () {
    const changes = !!this.replaceFile

    debugLogger('Check if replace file has changes', { replaceFile: this.replaceFile, changes })

    return changes
  }

  hasStudioTasks () {
    const changes = this.studioTasks.length !== 0

    debugLogger('Check if studio has changes', { studioTasks: this.studioTasks, changes })

    return changes
  }

  hasPlayerSettingsChanges () {
    if (!this.playerSettings) return false
    if (!this.saveStore.playerSettings) return true

    const changes = !this.areSameObjects(this.playerSettings, this.saveStore.playerSettings)

    debugLogger('Check if player settings has changes', {
      playerSettings: this.playerSettings,
      savePlayerSettings: this.saveStore.playerSettings,
      changes
    })

    return changes
  }

  // ---------------------------------------------------------------------------

  hasPendingChanges () {
    return this.hasCaptionChanges() ||
      this.hasLiveChanges() ||
      this.hasReplaceFile() ||
      this.hasStudioTasks() ||
      this.hasChaptersChanges() ||
      this.hasCommonChanges() ||
      this.hasPluginDataChanges() ||
      this.hasPlayerSettingsChanges()
  }

  // ---------------------------------------------------------------------------

  isPublishedVOD () {
    return !this.metadata.isLive && this.metadata.state === VideoState.PUBLISHED
  }

  private updateAfterChange () {
    this.videoAttributes = {
      id: this.metadata.id,
      shortUUID: this.metadata.shortUUID,
      uuid: this.metadata.uuid,
      name: this.common.name,
      state: this.metadata.state,
      privacy: this.common.privacy,
      isLive: this.metadata.isLive,
      aspectRatio: this.metadata.aspectRatio,
      views: this.metadata.views,
      likes: this.metadata.likes,
      duration: this.metadata.duration,
      blacklisted: this.metadata.blacklisted,

      ownerAccountId: this.metadata.ownerAccountId,
      ownerAccountDisplayName: this.metadata.ownerAccountDisplayName,

      live: this.metadata.live
    }
  }

  // ---------------------------------------------------------------------------

  areSameObjects<T, U> (a: Jsonify<T>, b: Jsonify<U>) {
    // Allow '' === null
    if (typeof a === 'string') return a === b || !a && b === null
    if (typeof b === 'string') return a === b || !b && a === null

    // Allow null === undefined
    if (a === undefined) return !exists(b)
    if (b === undefined) return !exists(a)

    if (a as any === b as any) return true

    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false
    }

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false

      if (!this.areSameObjects((a as any)[key], (b as any)[key])) return false
    }

    return true
  }

  // ---------------------------------------------------------------------------

  onSave () {
    this.isNewVideo = false
  }

  enableCheckPluginChanges () {
    this.checkPluginChanges = true
  }

  disableCheckPluginChanges () {
    this.checkPluginChanges = false
  }
}
