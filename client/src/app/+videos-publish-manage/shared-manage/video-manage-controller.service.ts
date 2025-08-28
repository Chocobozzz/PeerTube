import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable, OnDestroy } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ConfirmService, Notifier, PeerTubeRouterService } from '@app/core'
import { buildHTTPErrorResponse, genericUploadErrorHandler } from '@app/helpers'
import { FormReactiveErrors, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoPasswordService } from '@app/shared/shared-main/video/video-password.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import {
  HTMLServerConfig,
  HttpStatusCode,
  UserVideoQuota,
  VideoConstant,
  VideoPassword,
  VideoPrivacy,
  VideoPrivacyType,
  VideoState
} from '@peertube/peertube-models'
import debug from 'debug'
import { UploadState, UploadxService } from 'ngx-uploadx'
import { finalize, first, forkJoin, Observable, of, Subject, Subscription, switchMap, tap } from 'rxjs'
import { SelectChannelItem } from '../../../types'
import { VideoEdit } from './common/video-edit.model'
import { VideoManageType } from './common/video-manage.type'
import { VideoUploadService } from './common/video-upload.service'
import { VideoStudioService } from './studio/video-studio.service'

const debugLogger = debug('peertube:video-manage')

@Injectable()
export class VideoManageController implements OnDestroy {
  private loadingBar = inject(LoadingBarService)
  private videoService = inject(VideoService)
  private videoCaptionService = inject(VideoCaptionService)
  private videoChapterService = inject(VideoChapterService)
  private liveVideoService = inject(LiveVideoService)
  private videoPasswordService = inject(VideoPasswordService)
  private notifier = inject(Notifier)
  private videoUploadService = inject(VideoUploadService)
  private auth = inject(AuthService)
  private confirmService = inject(ConfirmService)
  private resumableUploadService = inject(UploadxService)
  private formReactiveService = inject(FormReactiveService)
  private videoStudio = inject(VideoStudioService)
  private peertubeRouter = inject(PeerTubeRouterService)
  private playerSettingsService = inject(PlayerSettingsService)

  private videoEdit: VideoEdit
  private userChannels: SelectChannelItem[]
  private userQuota: UserVideoQuota
  private privacies: VideoConstant<VideoPrivacyType>[]

  private manageType: VideoManageType
  private serverConfig: HTMLServerConfig

  private uploadingVideo = false
  private videoUploaded = false
  private videoUploadPercents: number
  private uploadError: string
  private retryUploadFn: () => any

  private isUpdatingVideo = false
  private videoUploadedSubject = new Subject<void>()
  private alreadyRefreshedToken = false

  private embedVersion = 1

  private uploadServiceSubscription: Subscription
  private pendingUpdateObs: Observable<any>
  private updatedSubject = new Subject<void>()

  private formErrors: { page: string, path: string, errors: string[] }[] = []
  private saveHook: () => Promise<any>

  constructor () {
    debugLogger('Building video manage controller service')

    this.resetUploadState()

    this.uploadServiceSubscription = this.resumableUploadService.events
      .subscribe(state => this.onUploadVideoOngoing(state))
  }

  ngOnDestroy () {
    debugLogger('Destroying video manage controller service')

    this.resumableUploadService.disconnect()
    this.uploadServiceSubscription?.unsubscribe()
  }

  reset () {
    this.manageType = undefined
    this.serverConfig = undefined
    this.videoEdit = undefined
    this.userChannels = undefined
    this.userQuota = undefined
    this.privacies = undefined
  }

  // ---------------------------------------------------------------------------

  setConfig (config: {
    manageType: VideoManageType
    serverConfig: HTMLServerConfig
  }) {
    this.manageType = config.manageType
    this.serverConfig = config.serverConfig
  }

  getConfig () {
    const videoAttrs = this.videoEdit.getVideoAttributes()
    const isPublish = new Set<VideoManageType>([ 'import-torrent', 'import-url', 'upload' ]).has(this.manageType)

    return {
      manageType: this.manageType,
      displayTranscriptionInfo: isPublish,

      hideWaitTranscoding: !isPublish && (videoAttrs.isLive || videoAttrs.state !== VideoState.TO_TRANSCODE),

      forbidScheduledPublication: this.getForbidScheduledPublication()
    }
  }

  private getForbidScheduledPublication () {
    if (this.manageType === 'upload') return false

    return this.manageType === 'update' && this.videoEdit.getVideoAttributes().privacy !== VideoPrivacy.PRIVATE
  }

  // ---------------------------------------------------------------------------

  setStore (store: {
    videoEdit: VideoEdit
    userChannels: SelectChannelItem[]
    userQuota: UserVideoQuota
    privacies: VideoConstant<VideoPrivacyType>[]
  }) {
    this.videoEdit = store.videoEdit
    this.userChannels = store.userChannels
    this.userQuota = store.userQuota
    this.privacies = store.privacies
  }

  setVideoEdit (videoEdit: VideoEdit) {
    this.videoEdit = videoEdit
  }

  getStore () {
    return {
      videoEdit: this.videoEdit,
      userChannels: this.userChannels,
      privacies: this.privacies
    }
  }

  setFormError (page: string, path: string, formErrors: FormReactiveErrors) {
    const errors = this.formReactiveService.grabAllErrors(formErrors)
    this.formErrors = this.formErrors.filter(e => e.page !== page)

    if (errors.length === 0) return

    this.formErrors.push({ page, path, errors })
  }

  getFormErrors () {
    return this.formErrors
  }

  hasFormErrors () {
    return this.formErrors.some(({ errors }) => errors.length !== 0)
  }

  getEmbedVersion () {
    return this.embedVersion
  }

  // ---------------------------------------------------------------------------

  registerSaveHook (fn: () => Promise<any>) {
    this.saveHook = fn
  }

  unregisterSaveHook () {
    this.saveHook = undefined
  }

  runSaveHook () {
    if (!this.saveHook) return Promise.resolve()

    return this.saveHook()
  }

  // ---------------------------------------------------------------------------

  hasPendingChanges () {
    return this.videoEdit.hasPendingChanges()
  }

  hasStudioTasks () {
    return this.videoEdit.hasStudioTasks()
  }

  hasReplaceFile () {
    return this.videoEdit.hasReplaceFile()
  }

  // ---------------------------------------------------------------------------

  isUpdating () {
    return this.isUpdatingVideo
  }

  getUpdatedObs () {
    return this.updatedSubject.asObservable()
  }

  updateVideo () {
    if (this.isUpdatingVideo === true) return

    this.cancelUploadIfNeeded()

    this.loadingBar.useRef().start()
    this.isUpdatingVideo = true

    const videoAttributes = this.videoEdit.getVideoAttributes()

    const isLive = !!this.videoEdit.getLive()

    this.pendingUpdateObs = this.videoUploadedSubject.pipe(
      tap(() => this.videoEdit.resetReplaceFile()),
      switchMap(() => {
        if (isLive || !this.videoEdit.hasCaptionChanges()) return of(true)

        debugLogger('Update captions')

        return this.videoCaptionService.updateCaptions(videoAttributes.uuid, this.videoEdit.getCaptionsEdit())
      }),
      switchMap(() => {
        if (isLive || !this.videoEdit.hasChaptersChanges()) return of(true)

        debugLogger('Update chapters')

        return this.videoChapterService.updateChapters(videoAttributes.uuid, this.videoEdit.getChaptersEdit())
      }),
      switchMap(() => {
        if (!this.videoEdit.hasPlayerSettingsChanges()) return of(true)

        debugLogger('Update player settings')

        return this.playerSettingsService.updateVideoSettings({
          videoId: videoAttributes.uuid,
          settings: this.videoEdit.getPlayerSettings()
        })
      }),
      switchMap(() => {
        if (!isLive || !this.videoEdit.hasLiveChanges()) return of(true)

        debugLogger('Update live')

        return this.liveVideoService.updateLive(videoAttributes.uuid, this.videoEdit.toLiveUpdate())
      }),
      switchMap(() => {
        debugLogger('Update video')

        return this.videoService.updateVideo(videoAttributes.uuid, this.videoEdit.toVideoUpdate())
      }),
      switchMap(() => {
        if (!this.videoEdit.hasStudioTasks()) return of(true)

        debugLogger('Run studio tasks')

        return this.videoStudio.editVideo(videoAttributes.uuid, this.videoEdit.getStudioTasks())
          .pipe(tap(() => this.videoEdit.resetStudio()))
      }),
      switchMap(() => {
        return forkJoin([
          this.videoService.getVideo({ videoId: videoAttributes.uuid }),

          this.videoEdit.getVideoAttributes().privacy === VideoPrivacy.PASSWORD_PROTECTED
            ? this.videoPasswordService.getVideoPasswords({ videoUUID: videoAttributes.uuid })
            : of([] as VideoPassword[]),

          isLive
            ? this.liveVideoService.getVideoLive(videoAttributes.uuid)
            : of(undefined),

          !isLive
            ? this.videoChapterService.getChapters({ videoId: videoAttributes.uuid })
            : of(undefined),

          !isLive
            ? this.videoCaptionService.listCaptions(videoAttributes.uuid)
            : of(undefined),

          this.playerSettingsService.getVideoSettings({ videoId: videoAttributes.uuid, raw: true })
        ])
      }),
      switchMap(([ video, videoPasswords, live, chaptersRes, captionsRes, playerSettings ]) => {
        return this.videoEdit.loadFromAPI({
          video,
          videoPasswords: videoPasswords.map(p => p.password),
          live,
          chapters: chaptersRes?.chapters,
          captions: captionsRes?.data,
          playerSettings
        })
      }),
      first(), // To complete
      finalize(() => {
        debugLogger('Update complete')

        this.videoEdit.onSave()
        this.loadingBar.useRef().complete()
        this.isUpdatingVideo = false
        this.updatedSubject.next()
        this.embedVersion++
      })
    )

    setTimeout(() => this.replaceFileIfNeeded())

    return this.pendingUpdateObs
  }

  private replaceFileIfNeeded () {
    if (!this.videoEdit.hasReplaceFile()) {
      debugLogger('No file to replace')
      this.videoUploadedSubject.next()
      return
    }

    debugLogger('Upload file replacement')
    this.uploadFileReplacement(this.videoEdit.getReplaceFile())
  }

  private uploadFileReplacement (file: File) {
    this.uploadingVideo = true
    this.retryUploadFn = () => this.uploadFileReplacement(file)

    const metadata = { filename: file.name }

    this.resumableUploadService.handleFiles(file, {
      ...this.videoUploadService.getReplaceUploadxOptions(this.videoEdit.getVideoAttributes().uuid),

      metadata
    })
  }

  cancelUploadIfNeeded () {
    if (this.uploadingVideo) {
      this.resumableUploadService.control({ action: 'cancel' })
    }

    this.videoUploadedSubject = new Subject<void>()

    this.pendingUpdateObs = undefined
    this.loadingBar.useRef().complete()

    this.resetUploadState()
  }

  retryUpload () {
    this.retryUploadFn()
  }

  // ---------------------------------------------------------------------------

  async checkAndConfirmVideoFileReplacement () {
    if (!this.videoEdit.hasReplaceFile()) return true

    if (this.videoEdit.hasStudioTasks()) {
      this.notifier.error($localize`You cannot replace the video file and also have studio tasks.`)
      return false
    }

    const replaceFile = this.videoEdit.getReplaceFile()

    if (!this.checkUserQuota(replaceFile)) return false

    const videoAttributes = this.videoEdit.getVideoAttributes()
    const willBeBlocked = this.serverConfig.autoBlacklist.videos.ofUsers.enabled === true && !videoAttributes.blacklisted

    let blockedWarning = ''
    if (willBeBlocked) {
      blockedWarning = ' ' +
        $localize`Your video will also be automatically blocked since video publication requires manual validation by moderators.`
    }

    const message = $localize`Uploading a new version of your video will completely erase the current version.` +
      blockedWarning +
      ' ' +
      $localize`<br /><br />Do you still want to replace your video file?`

    const res = await this.confirmService.confirm(message, $localize`Replace file warning`)
    if (res === false) return false

    return true
  }

  async checkAndConfirmStudioTasks () {
    if (!this.videoEdit.hasStudioTasks()) return true

    const title = $localize`Are you sure you want to create studio tasks for "${this.videoEdit.getVideoAttributes().name}"?`
    const listHTML = this.videoEdit.getStudioTasksSummary().map(t => `<li>${t}</li>`).join('')

    const confirmHTML =
      // eslint-disable-next-line max-len
      $localize`The current video will be overwritten by this edited video and <strong>you won't be able to recover it</strong>.<br /><br />` +
      $localize`As a reminder, the following tasks will be executed: <ol>${listHTML}</ol>`

    if (await this.confirmService.confirm(confirmHTML, title) !== true) return false

    return true
  }

  checkUserQuota (file: File) {
    const user = this.auth.getUser()

    if (!this.videoUploadService.checkQuotaAndNotify(file, user.videoQuota, this.userQuota.videoQuotaUsed)) return false
    if (!this.videoUploadService.checkQuotaAndNotify(file, user.videoQuotaDaily, this.userQuota.videoQuotaUsedDaily)) return false

    return true
  }

  // ---------------------------------------------------------------------------

  silentRedirectOnManage (shortUUID: string, route: ActivatedRoute) {
    this.peertubeRouter.silentNavigate([ '.' ], { publishedId: shortUUID, uploading: null }, route)
  }

  silentRedirectOnUploading (route: ActivatedRoute) {
    this.peertubeRouter.silentNavigate([ '.' ], { publishedId: null, uploading: 'true' }, route)
  }

  silentRedirectOnAbortUpload (route: ActivatedRoute) {
    this.peertubeRouter.silentNavigate([ '.' ], { publishedId: null, uploading: null }, route)
  }

  // ---------------------------------------------------------------------------

  uploadNewVideo (options: {
    file: File
    privacy: VideoPrivacyType
    previewfile?: File
  }) {
    this.resetUploadState()

    this.uploadingVideo = true
    this.retryUploadFn = () => this.uploadNewVideo(options)

    const metadata = {
      ...this.videoEdit.toVideoCreate(options.privacy),

      filename: options.file.name,
      previewfile: options.previewfile
    }

    this.resumableUploadService.handleFiles(options.file, {
      ...this.videoUploadService.getNewVideoUploadxOptions(),

      metadata
    })
  }

  private resetUploadState () {
    this.videoUploaded = false
    this.uploadingVideo = false
    this.videoUploadPercents = 0
    this.uploadError = ''
  }

  getUploadEventsObs () {
    return this.resumableUploadService.events
  }

  getUploadPercents () {
    return this.videoUploadPercents
  }

  getUploadError () {
    return this.uploadError
  }

  isUploadingFile () {
    return this.uploadingVideo
  }

  hasUploadedFile () {
    return this.videoUploaded
  }

  // ---------------------------------------------------------------------------

  private onUploadVideoOngoing (state: UploadState) {
    debugLogger('Upload state update', state)

    switch (state.status) {
      case 'error': {
        if (!this.alreadyRefreshedToken && state.responseStatus === HttpStatusCode.UNAUTHORIZED_401) {
          this.alreadyRefreshedToken = true

          return this.refreshTokenAndRetryUpload()
        }

        this.handleUploadError(buildHTTPErrorResponse(state))
        break
      }

      case 'cancelled':
        this.uploadingVideo = false
        this.videoUploadPercents = 0
        this.uploadError = ''
        break

      case 'uploading':
        this.videoUploadPercents = state.progress || 0
        break

      case 'paused':
        this.notifier.info($localize`Upload on hold`)
        break

      case 'complete':
        this.uploadingVideo = false
        this.videoUploadPercents = 100
        this.videoUploaded = true
        this.videoUploadedSubject.next()
        break
    }
  }

  private handleUploadError (err: HttpErrorResponse) {
    this.videoUploadPercents = 0
    this.uploadingVideo = false

    this.uploadError = genericUploadErrorHandler({ err, name: $localize`video` })

    this.videoUploadedSubject.error(err)
  }

  private refreshTokenAndRetryUpload () {
    this.auth.refreshAccessToken()
      .subscribe(() => this.retryUploadFn())
  }
}
