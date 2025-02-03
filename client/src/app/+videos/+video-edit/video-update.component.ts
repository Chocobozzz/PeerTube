import debug from 'debug'
import { UploadState, UploadxService } from 'ngx-uploadx'
import { of, Subject, Subscription } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { HttpErrorResponse } from '@angular/common/http'
import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, CanComponentDeactivate, ConfirmService, Notifier, ServerService, UserService } from '@app/core'
import { buildHTTPErrorResponse, genericUploadErrorHandler } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { simpleObjectsDeepEqual } from '@peertube/peertube-core-utils'
import { HttpStatusCode, LiveVideo, LiveVideoUpdate, VideoPrivacy, VideoSource, VideoState } from '@peertube/peertube-models'
import { hydrateFormFromVideo } from './shared/video-edit-utils'
import { VideoUploadService } from './shared/video-upload.service'
import { VideoEditComponent } from './shared/video-edit.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { ReactiveFileComponent } from '../../shared/shared-forms/reactive-file.component'
import { NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { UploadProgressComponent } from '../../shared/standalone-upload/upload-progress.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoEdit } from '@app/shared/shared-main/video/video-edit.model'
import { VideoCaptionEdit } from '@app/shared/shared-main/video-caption/video-caption-edit.model'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoChaptersEdit } from '@app/shared/shared-main/video/video-chapters-edit.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'

const debugLogger = debug('peertube:video-update')

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './shared/video-edit.component.scss' ],
  templateUrl: './video-update.component.html',
  imports: [
    RouterLink,
    UploadProgressComponent,
    FormsModule,
    ReactiveFormsModule,
    VideoEditComponent,
    NgIf,
    ReactiveFileComponent,
    ButtonComponent
  ]
})
export class VideoUpdateComponent extends FormReactive implements OnInit, OnDestroy, CanComponentDeactivate {
  @ViewChild('videoEdit', { static: false }) videoEditComponent: VideoEditComponent

  videoEdit: VideoEdit
  videoDetails: VideoDetails
  videoSource: VideoSource
  userVideoChannels: SelectChannelItem[] = []
  videoCaptions: VideoCaptionEdit[] = []
  liveVideo: LiveVideo

  userVideoQuotaUsed = 0
  userVideoQuotaUsedDaily = 0

  isUpdatingVideo = false
  forbidScheduledPublication = false

  isReplacingVideoFile = false
  videoUploadPercents: number
  uploadError: string

  updateDone = false

  private videoReplacementUploadedSubject = new Subject<void>()
  private alreadyRefreshedToken = false

  private uploadServiceSubscription: Subscription
  private updateSubcription: Subscription

  private chaptersEdit = new VideoChaptersEdit()

  constructor (
    protected formReactiveService: FormReactiveService,
    private route: ActivatedRoute,
    private router: Router,
    private notifier: Notifier,
    private videoService: VideoService,
    private loadingBar: LoadingBarService,
    private videoCaptionService: VideoCaptionService,
    private videoChapterService: VideoChapterService,
    private server: ServerService,
    private liveVideoService: LiveVideoService,
    private videoUploadService: VideoUploadService,
    private confirmService: ConfirmService,
    private auth: AuthService,
    private userService: UserService,
    private resumableUploadService: UploadxService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      replaceFile: null
    })

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => {
        this.userVideoQuotaUsed = data.videoQuotaUsed
        this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
      })

    this.uploadServiceSubscription = this.resumableUploadService.events
      .subscribe(state => this.onUploadVideoOngoing(state))

    const { videoData } = this.route.snapshot.data
    const { video, videoChannels, videoCaptions, videoChapters, videoSource, liveVideo, videoPassword } = videoData

    this.videoDetails = video
    this.videoEdit = new VideoEdit(this.videoDetails, videoPassword)
    this.chaptersEdit.loadFromAPI(videoChapters)

    this.userVideoChannels = videoChannels
    this.videoCaptions = videoCaptions
    this.videoSource = videoSource
    this.liveVideo = liveVideo

    this.forbidScheduledPublication = this.videoEdit.privacy !== VideoPrivacy.PRIVATE
  }

  ngOnDestroy () {
    this.resumableUploadService.disconnect()

    if (this.uploadServiceSubscription) this.uploadServiceSubscription.unsubscribe()
  }

  onFormBuilt () {
    hydrateFormFromVideo(this.form, this.videoEdit, true)

    setTimeout(() => this.videoEditComponent.patchChapters(this.chaptersEdit))

    if (this.liveVideo) {
      this.form.patchValue({
        saveReplay: this.liveVideo.saveReplay,
        replayPrivacy: this.liveVideo.replaySettings ? this.liveVideo.replaySettings.privacy : VideoPrivacy.PRIVATE,
        latencyMode: this.liveVideo.latencyMode,
        permanentLive: this.liveVideo.permanentLive
      })
    }
  }

  @HostListener('window:beforeunload', [ '$event' ])
  onUnload (event: any) {
    const { text, canDeactivate } = this.canDeactivate()

    if (canDeactivate) return

    event.returnValue = text
    return text
  }

  canDeactivate (): { canDeactivate: boolean, text?: string } {
    if (this.updateDone === true) return { canDeactivate: true }

    if (this.isUpdatingVideo) {
      return {
        canDeactivate: false,
        text: $localize`Your video is currently being updated. If you leave, your changes will be lost.`
      }
    }

    const text = $localize`You have unsaved changes! If you leave, your changes will be lost.`

    for (const caption of this.videoCaptions) {
      if (caption.action) return { canDeactivate: false, text }
    }

    return { canDeactivate: this.formChanged === false, text }
  }

  getVideoExtensions () {
    return this.videoUploadService.getVideoExtensions()
  }

  isWaitTranscodingHidden () {
    return this.videoDetails.state.id !== VideoState.TO_TRANSCODE
  }

  isUpdateVideoFileEnabled () {
    if (!this.server.getHTMLConfig().videoFile.update.enabled) return false

    if (this.videoDetails.isLive) return false
    if (this.videoDetails.state.id !== VideoState.PUBLISHED) return false

    return true
  }

  async update () {
    await this.waitPendingCheck()
    this.forceCheck()

    if (!this.form.valid || this.isUpdatingVideo === true) return

    // Check and warn users about a file replacement
    if (!await this.checkAndConfirmVideoFileReplacement()) return

    this.videoEdit.patch(this.form.value)
    this.chaptersEdit.patch(this.form.value)

    this.abortUpdateIfNeeded()

    this.loadingBar.useRef().start()
    this.isUpdatingVideo = true

    this.updateSubcription = this.videoReplacementUploadedSubject.pipe(
      switchMap(() => this.videoService.updateVideo(this.videoEdit)),
      switchMap(() => this.videoCaptionService.updateCaptions(this.videoEdit.uuid, this.videoCaptions)),
      switchMap(() => {
        if (this.liveVideo) return of(true)

        return this.videoChapterService.updateChapters(this.videoEdit.uuid, this.chaptersEdit)
      }),
      switchMap(() => {
        if (!this.liveVideo) return of(undefined)

        const saveReplay = !!this.form.value.saveReplay
        const replaySettings = saveReplay
          ? { privacy: this.form.value.replayPrivacy }
          : undefined

        const liveVideoUpdate: LiveVideoUpdate = {
          saveReplay,
          replaySettings,
          permanentLive: !!this.form.value.permanentLive,
          latencyMode: this.form.value.latencyMode
        }

        // Don't update live attributes if they did not change
        const baseVideo = {
          saveReplay: this.liveVideo.saveReplay,
          replaySettings: this.liveVideo.replaySettings,
          permanentLive: this.liveVideo.permanentLive,
          latencyMode: this.liveVideo.latencyMode
        }
        const liveChanged = !simpleObjectsDeepEqual(baseVideo, liveVideoUpdate)
        if (!liveChanged) return of(undefined)

        return this.liveVideoService.updateLive(this.videoEdit.id, liveVideoUpdate)
      }),

      map(() => true),

      catchError(err => {
        this.notifier.error(err.message)

        return of(false)
      })
    )
    .subscribe({
      next: success => {
        this.isUpdatingVideo = false
        this.loadingBar.useRef().complete()

        if (!success) return

        this.updateDone = true
        this.notifier.success($localize`Video updated.`)
        this.router.navigateByUrl(Video.buildWatchUrl(this.videoEdit))
      }
    })

    this.replaceFileIfNeeded()
  }

  hydratePluginFieldsFromVideo () {
    if (!this.videoEdit.pluginData) return

    this.form.patchValue({
      pluginData: this.videoEdit.pluginData
    })
  }

  getVideoUrl () {
    return Video.buildWatchUrl(this.videoDetails)
  }

  private async checkAndConfirmVideoFileReplacement () {
    const replaceFile: File = this.form.value['replaceFile']
    if (!replaceFile) return true

    const user = this.auth.getUser()
    if (!this.videoUploadService.checkQuotaAndNotify(replaceFile, user.videoQuota, this.userVideoQuotaUsed)) return
    if (!this.videoUploadService.checkQuotaAndNotify(replaceFile, user.videoQuotaDaily, this.userVideoQuotaUsedDaily)) return

    const willBeBlocked = this.server.getHTMLConfig().autoBlacklist.videos.ofUsers.enabled === true && !this.videoDetails.blacklisted
    let blockedWarning = ''
    if (willBeBlocked) {
      // eslint-disable-next-line max-len
      blockedWarning = ' ' + $localize`Your video will also be automatically blocked since video publication requires manual validation by moderators.`
    }

    const message = $localize`Uploading a new version of your video will completely erase the current version.` +
      blockedWarning +
      ' ' +
      $localize`<br /><br />Do you still want to replace your video file?`

    const res = await this.confirmService.confirm(message, $localize`Replace file warning`)
    if (res === false) return false

    return true
  }

  private replaceFileIfNeeded () {
    if (!this.form.value['replaceFile']) {
      this.videoReplacementUploadedSubject.next()
      return
    }

    this.uploadFileReplacement(this.form.value['replaceFile'])
  }

  private uploadFileReplacement (file: File) {
    const metadata = {
      filename: file.name
    }

    this.resumableUploadService.handleFiles(file, {
      ...this.videoUploadService.getReplaceUploadxOptions(this.videoDetails.uuid),

      metadata
    })

    this.isReplacingVideoFile = true
  }

  onUploadVideoOngoing (state: UploadState) {
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
        this.isReplacingVideoFile = false
        this.videoUploadPercents = 0
        this.uploadError = ''
        break

      case 'uploading':
        this.videoUploadPercents = state.progress || 0
        break

      case 'complete':
        this.isReplacingVideoFile = false
        this.videoReplacementUploadedSubject.next()
        this.videoUploadPercents = 100
        break
    }
  }

  cancelUpload () {
    debugLogger('Cancelling upload')

    this.resumableUploadService.control({ action: 'cancel' })

    this.abortUpdateIfNeeded()
  }

  private handleUploadError (err: HttpErrorResponse) {
    this.videoUploadPercents = 0
    this.isReplacingVideoFile = false

    this.uploadError = genericUploadErrorHandler({ err, name: $localize`video` })

    this.videoReplacementUploadedSubject.error(err)
  }

  private refreshTokenAndRetryUpload () {
    this.auth.refreshAccessToken()
      .subscribe(() => this.uploadFileReplacement(this.form.value['replaceFile']))
  }

  private abortUpdateIfNeeded () {
    if (this.updateSubcription) {
      this.updateSubcription.unsubscribe()
      this.updateSubcription = undefined
    }

    this.videoReplacementUploadedSubject = new Subject<void>()
    this.loadingBar.useRef().complete()
  }
}
