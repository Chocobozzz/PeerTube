import { NgIf } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, MetaService, Notifier, ServerService, UserService } from '@app/core'
import { buildHTTPErrorResponse, genericUploadErrorHandler, scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoEdit } from '@app/shared/shared-main/video/video-edit.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { HttpStatusCode, VideoCreateResult } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { truncate } from 'lodash-es'
import { UploadState, UploadxService } from 'ngx-uploadx'
import { Subscription } from 'rxjs'
import { PreviewUploadComponent } from '../../../shared/shared-forms/preview-upload.component'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { UploadProgressComponent } from '../../../shared/standalone-upload/upload-progress.component'
import { VideoEditComponent } from '../shared/video-edit.component'
import { VideoUploadService } from '../shared/video-upload.service'
import { DragDropDirective } from './drag-drop.directive'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-upload.component.scss',
    './video-send.scss'
  ],
  imports: [
    NgIf,
    DragDropDirective,
    GlobalIconComponent,
    NgbTooltip,
    SelectChannelComponent,
    FormsModule,
    SelectOptionsComponent,
    PreviewUploadComponent,
    ButtonComponent,
    UploadProgressComponent,
    ReactiveFormsModule,
    VideoEditComponent,
    AlertComponent
  ]
})
export class VideoUploadComponent extends VideoSend implements OnInit, OnDestroy, AfterViewInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  @ViewChild('videofileInput') videofileInput: ElementRef<HTMLInputElement>

  userVideoQuotaUsed = 0
  userVideoQuotaUsedDaily = 0

  isUploadingAudioFile = false
  isUploadingVideo = false

  videoUploaded = false
  videoUploadPercents = 0
  videoUploadedIds: VideoCreateResult = {
    id: 0,
    uuid: '',
    shortUUID: ''
  }
  formData: FormData

  previewfileUpload: File

  error: string
  enableRetryAfterError: boolean

  private isUpdatingVideo = false
  private fileToUpload: File

  private alreadyRefreshedToken = false

  private uploadServiceSubscription: Subscription

  constructor (
    protected formReactiveService: FormReactiveService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    protected videoChapterService: VideoChapterService,
    private userService: UserService,
    private router: Router,
    private hooks: HooksService,
    private resumableUploadService: UploadxService,
    private metaService: MetaService,
    private route: ActivatedRoute,
    private videoUploadService: VideoUploadService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    this.userService.getMyVideoQuotaUsed()
        .subscribe(data => {
          this.userVideoQuotaUsed = data.videoQuotaUsed
          this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
        })

    this.uploadServiceSubscription = this.resumableUploadService.events
      .subscribe(state => this.onUploadVideoOngoing(state))
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-upload.init', 'video-edit')
  }

  ngOnDestroy () {
    this.resumableUploadService.disconnect()

    if (this.uploadServiceSubscription) this.uploadServiceSubscription.unsubscribe()
  }

  canDeactivate () {
    let text = ''

    if (this.videoUploaded === true) {
      // We can't concatenate strings using $localize
      text = $localize`Your video was uploaded to your account and is private.` + ' ' +
        $localize`But associated data (tags, description...) will be lost, are you sure you want to leave this page?`
    } else {
      text = $localize`Your video is not uploaded yet, are you sure you want to leave this page?`
    }

    return {
      canDeactivate: !this.isUploadingVideo,
      text
    }
  }

  updateTitle () {
    const videoName = this.form.get('name').value

    if (this.videoUploaded) {
      this.metaService.setTitle($localize`Publish ${videoName}`)
    } else if (this.isUploadingAudioFile || this.isUploadingVideo) {
      this.metaService.setTitle(`${this.videoUploadPercents}% - ${videoName}`)
    } else {
      this.metaService.update(this.route.snapshot.data['meta'])
    }
  }

  getVideoExtensions () {
    return this.videoUploadService.getVideoExtensions().join(', ')
  }

  onUploadVideoOngoing (state: UploadState) {
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
        this.isUploadingVideo = false
        this.videoUploadPercents = 0

        this.firstStepError.emit()
        this.enableRetryAfterError = false
        this.error = ''
        this.isUploadingAudioFile = false
        break

      case 'queue':
        this.closeFirstStep(state.name)
        break

      case 'uploading':
        this.videoUploadPercents = state.progress
        break

      case 'paused':
        this.notifier.info($localize`Upload on hold`)
        break

      case 'complete':
        this.videoUploaded = true
        this.videoUploadPercents = 100

        this.videoUploadedIds = state?.response.video
        break
    }

    this.updateTitle()
  }

  onFileDropped (files: FileList) {
    this.videofileInput.nativeElement.files = files

    this.onFileChange({ target: this.videofileInput.nativeElement })
  }

  onFileChange (event: Event | { target: HTMLInputElement }) {
    const file = (event.target as HTMLInputElement).files[0]

    if (!file) return

    const user = this.authService.getUser()

    if (!this.videoUploadService.checkQuotaAndNotify(file, user.videoQuota, this.userVideoQuotaUsed)) return
    if (!this.videoUploadService.checkQuotaAndNotify(file, user.videoQuotaDaily, this.userVideoQuotaUsedDaily)) return

    if (this.videoUploadService.isAudioFile(file.name)) {
      this.isUploadingAudioFile = true
      return
    }

    this.isUploadingVideo = true
    this.fileToUpload = file

    this.uploadFile(file)
  }

  uploadAudio () {
    this.uploadFile(this.getInputVideoFile(), this.previewfileUpload)
  }

  retryUpload () {
    this.enableRetryAfterError = false
    this.error = ''
    this.uploadFile(this.fileToUpload)
  }

  cancelUpload () {
    this.resumableUploadService.control({ action: 'cancel' })
  }

  isPublishingButtonDisabled () {
    return !this.form.valid ||
      this.isUpdatingVideo === true ||
      this.videoUploaded !== true ||
      !this.videoUploadedIds.id
  }

  getAudioUploadLabel () {
    const videofile = this.getInputVideoFile()
    if (!videofile) return $localize`Upload`

    return $localize`Upload ${videofile.name}`
  }

  async updateSecondStep () {
    if (!await this.isFormValid()) return
    if (this.isPublishingButtonDisabled()) return

    const video = new VideoEdit()
    video.patch(this.form.value)
    video.id = this.videoUploadedIds.id
    video.uuid = this.videoUploadedIds.uuid
    video.shortUUID = this.videoUploadedIds.shortUUID

    this.chaptersEdit.patch(this.form.value)

    this.isUpdatingVideo = true

    this.updateVideoAndCaptionsAndChapters({ video, captions: this.videoCaptions, chapters: this.chaptersEdit })
        .subscribe({
          next: () => {
            this.isUpdatingVideo = false
            this.isUploadingVideo = false

            this.notifier.success($localize`Video published.`)
            this.router.navigateByUrl(Video.buildWatchUrl(video))
          },

          error: err => {
            this.error = err.message
            scrollToTop()
            logger.error(err)
          }
        })
  }

  private getInputVideoFile () {
    return this.videofileInput.nativeElement.files[0]
  }

  private uploadFile (file: File, previewfile?: File) {
    const metadata = {
      waitTranscoding: true,
      channelId: this.firstStepChannelId,
      nsfw: this.serverConfig.instance.isNSFW,
      privacy: this.highestPrivacy.toString(),
      name: this.buildVideoFilename(file.name),
      filename: file.name,
      previewfile: previewfile as any
    }

    this.resumableUploadService.handleFiles(file, {
      ...this.videoUploadService.getNewUploadxOptions(),

      metadata
    })

    this.isUploadingVideo = true
  }

  private handleUploadError (err: HttpErrorResponse) {
    // Reset progress (but keep isUploadingVideo true)
    this.videoUploadPercents = 0
    this.enableRetryAfterError = true

    this.error = genericUploadErrorHandler({
      err,
      name: $localize`video`,
      notifier: this.notifier,
      sticky: false
    })

    if (err.status === HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415) {
      this.cancelUpload()
    }
  }

  private closeFirstStep (filename: string) {
    const name = this.buildVideoFilename(filename)

    this.form.patchValue({
      name,
      privacy: this.firstStepPrivacyId,
      nsfw: this.serverConfig.instance.isNSFW,
      channelId: this.firstStepChannelId,
      previewfile: this.previewfileUpload
    })

    this.firstStepDone.emit(name)
    this.updateTitle()
  }

  private buildVideoFilename (filename: string) {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '')
    let name = nameWithoutExtension.length < 3
      ? filename
      : nameWithoutExtension

    const videoNameMaxSize = 110
    if (name.length > videoNameMaxSize) {
      name = truncate(name, { length: videoNameMaxSize, omission: '' })
    }

    return name
  }

  private refreshTokenAndRetryUpload () {
    this.authService.refreshAccessToken()
      .subscribe(() => this.retryUpload())
  }
}
