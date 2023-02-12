import { UploadState, UploadxOptions, UploadxService } from 'ngx-uploadx'
import { HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http'
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, CanComponentDeactivate, MetaService, Notifier, ServerService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { isIOS } from '@root-helpers/web-browser'
import { HTMLServerConfig, HttpStatusCode, VideoCreateResult } from '@shared/models'
import { UploaderXFormData } from './uploaderx-form-data'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-video-replace',
  templateUrl: './video-replace.component.html',
  styleUrls: [
    './video-replace.component.scss'
  ]
})
export class VideoReplaceComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  @Input() videoShortUUID: string
  @ViewChild('videofileInput') videofileInput: ElementRef<HTMLInputElement>

  isUploadingAudioFile = false
  isUploadingVideo = false

  videoUploaded = false
  videoUploadPercents = 0
  videoUploadedIds: VideoCreateResult = {
    id: 0,
    uuid: '',
    shortUUID: ''
  }

  error: string
  enableRetryAfterError: boolean

  private isUpdatingVideo = false
  private fileToUpload: File

  private alreadyRefreshedToken = false

  private uploadServiceSubscription: Subscription

  protected serverConfig: HTMLServerConfig

  constructor (
    protected formReactiveService: FormReactiveService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private resumableUploadService: UploadxService,
    private metaService: MetaService,
    private route: ActivatedRoute
  ) {
  }

  get videoExtensions () {
    return this.serverConfig.video.file.extensions.join(', ')
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.uploadServiceSubscription = this.resumableUploadService.events
      .subscribe(state => this.onUploadVideoOngoing(state))
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
    if (this.videoUploaded) {
      this.metaService.setTitle($localize`Edit video`)
    } else if (this.isUploadingAudioFile || this.isUploadingVideo) {
      // this.metaService.setTitle(`${this.videoUploadPercents}% - ${videoName}`)
    } else {
      this.metaService.update(this.route.snapshot.data['meta'])
    }
  }

  onUploadVideoOngoing (state: UploadState) {
    switch (state.status) {
      case 'error': {
        if (!this.alreadyRefreshedToken && state.responseStatus === HttpStatusCode.UNAUTHORIZED_401) {
          this.alreadyRefreshedToken = true

          return this.refereshTokenAndRetryUpload()
        }

        const error = state.response?.error?.message || state.response?.error || 'Unknown error'

        this.handleUploadError({
          error: new Error(error),
          name: 'HttpErrorResponse',
          message: error,
          ok: false,
          headers: new HttpHeaders(state.responseHeaders),
          status: +state.responseStatus,
          statusText: error,
          type: HttpEventType.Response,
          url: state.url
        })
        break
      }

      case 'cancelled':
        this.isUploadingVideo = false
        this.videoUploadPercents = 0

        this.enableRetryAfterError = false
        this.error = ''
        this.isUploadingAudioFile = false
        break

      case 'queue':
        // this.closeFirstStep(state.name)
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

    // if (!this.checkGlobalUserQuota(file)) return
    // if (!this.checkDailyUserQuota(file)) return

    if (this.isAudioFile(file.name)) {
      this.isUploadingAudioFile = true
      return
    }

    this.isUploadingVideo = true
    this.fileToUpload = file

    this.uploadFile(file)
  }

  uploadAudio () {
    // this.uploadFile(this.getInputVideoFile(), this.previewfileUpload)
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
    return this.isUpdatingVideo === true ||
      this.videoUploaded !== true ||
      !this.videoUploadedIds.id
  }

  getAudioUploadLabel () {
    const videofile = this.getInputVideoFile()
    if (!videofile) return $localize`Upload`

    return $localize`Upload ${videofile.name}`
  }

  private getInputVideoFile () {
    return this.videofileInput.nativeElement.files[0]
  }

  private uploadFile (file: File) {
    const metadata = {
      waitTranscoding: true,
      filename: file.name
    }

    this.resumableUploadService.handleFiles(file, {
      ...this.getUploadxOptions(),

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

  private isAudioFile (filename: string) {
    const extensions = [ '.mp3', '.flac', '.ogg', '.wma', '.wav' ]

    return extensions.some(e => filename.endsWith(e))
  }

  private refereshTokenAndRetryUpload () {
    this.authService.refreshAccessToken()
      .subscribe(() => this.retryUpload())
  }

  private getUploadxOptions (): UploadxOptions {
    // FIXME: https://github.com/Chocobozzz/PeerTube/issues/4382#issuecomment-915854167
    const chunkSize = isIOS()
      ? 0
      : undefined // Auto chunk size

    return {
      endpoint: '/api/v1/videos/upload-resumable/' + this.videoShortUUID,
      multiple: false,

      maxChunkSize: this.serverConfig.client.videos.resumableUpload.maxChunkSize,
      chunkSize,

      token: this.authService.getAccessToken(),

      uploaderClass: UploaderXFormData,

      retryConfig: {
        maxAttempts: 30, // maximum attempts for 503 codes, otherwise set to 6, see below
        maxDelay: 120_000, // 2 min
        shouldRetry: (code: number, attempts: number) => {
          return code === HttpStatusCode.SERVICE_UNAVAILABLE_503 || ((code < 400 || code > 500) && attempts < 6)
        }
      }
    }
  }
}
