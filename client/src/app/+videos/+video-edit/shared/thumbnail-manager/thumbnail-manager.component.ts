import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { imageToDataURL } from '../../../../../root-helpers/images'
import { BytesPipe } from '../../../../shared/shared-main/angular/bytes.pipe'

import { addQueryParams } from '@peertube/peertube-core-utils'

import { map, of, switchMap } from 'rxjs'
import {
  Component,
  forwardRef,
  OnInit
} from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
  ConfirmService,
  Notifier,
  RestExtractor,
  ServerService
} from '../../../../core'
import { VideoDetails } from '../../../../shared/shared-main/video/video-details.model'
import { VideoFileTokenService } from '../../../../shared/shared-main/video/video-file-token.service'
import { VideoService } from '../../../../shared/shared-main/video/video.service'
import {
  HTMLServerConfig,
  HttpStatusCode,
  PeerTubeProblemDocument,
  ServerErrorCode
} from '@peertube/peertube-models'
import { videoRequiresFileToken } from '../../../../../root-helpers/video'
import { FrameSelectorComponent } from './frame-selector.component'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'

@Component({
  selector: 'my-thumbnail-manager',
  styleUrls: [ './thumbnail-manager.component.scss' ],
  templateUrl: './thumbnail-manager.component.html',
  standalone: true,
  imports: [ CommonModule, FrameSelectorComponent, ReactiveFileComponent ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ThumbnailManagerComponent),
      multi: true
    }
  ]
})
export class ThumbnailManagerComponent implements OnInit, ControlValueAccessor {

  previewWidth = '360px'
  previewHeight = '200px'

  imageSrc: string
  allowedExtensionsMessage = ''
  maxSizeText: string

  serverConfig: HTMLServerConfig
  bytesPipe: BytesPipe
  file: Blob

  // State Toggle (Upload, Select Frame)
  selectingFromVideo = false

  source: string

  currentTime = 0

  videoId: string
  videoDetails: VideoDetails

  constructor (
    private confirmService: ConfirmService,
    private notifier: Notifier,
    private restExtractor: RestExtractor,
    private route: ActivatedRoute,
    private serverService: ServerService,
    private videoFileTokenService: VideoFileTokenService,
    private videoService: VideoService
  ) {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = $localize`max size`
  }

  // Section - Upload
  get videoImageExtensions () {
    return this.serverConfig.video.image.extensions
  }

  get maxVideoImageSize () {
    return this.serverConfig.video.image.size.max
  }

  get maxVideoImageSizeInBytes () {
    return this.bytesPipe.transform(this.maxVideoImageSize)
  }

  getReactiveFileButtonTooltip () {
    return $localize`(extensions: ${this.videoImageExtensions}, ${this.maxSizeText}\: ${this.maxVideoImageSizeInBytes})`
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.allowedExtensionsMessage = this.videoImageExtensions.join(', ')
  }

  onFileChanged (file: Blob) {
    this.file = file

    this.propagateChange(this.file)
    this.updatePreview()
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (file: any) {
    this.file = file
    this.updatePreview()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  private updatePreview () {
    if (this.file) {
      imageToDataURL(this.file).then(result => this.imageSrc = result)
    }
  }
  // End Section - Upload

  // Section - Select From Frame

  selectFromVideo () {

    this.selectingFromVideo = true

    this.route.params.subscribe(routeParams => {

      this.videoId = routeParams['uuid']

      if (!this.videoId) {
        return
      }

      return this.loadVideo({ videoId: this.videoId })
    })
  }

  resetSelectFromVideo () {

    this.selectingFromVideo = false
  }

  selectFrame () {

    this.selectingFromVideo = false

    this.videoService.setThumbnailAtTimecode(this.videoDetails.id.toString(), this.currentTime.toString())
      .subscribe((response) => {
        this.imageSrc = response
      })
  }

  getCurrentTime () {
    return this.currentTime
  }

  setCurrentTime (value: number) {
    this.currentTime = value
  }

  private loadVideo (options: {
    videoId: string
  }) {
    const { videoId } = options

    this.videoService.getVideo({ videoId }).pipe(
      switchMap(video => {

        if (!videoRequiresFileToken(video)) return of({ video, videoFileToken: undefined })

        return this.videoFileTokenService.getVideoFileToken({ videoUUID: video.uuid })
          .pipe(map((token) => ({ video, videoFileToken: token.token })))

      }))
      .subscribe({
        next: ({ video, videoFileToken }) => {
          this.onVideoFetched({
            video,
            videoFileToken
          })
        },
        error: err => {
          this.handleRequestError(err)
        }
      })
  }

  private onVideoFetched (options: {
    video: VideoDetails
    videoFileToken: string
  }) {
    const {
      video,
      videoFileToken
    } = options

    this.videoDetails = video

    const videoFiles = video.getFiles()

    if (videoFiles == null) {
      if (videoFiles.length === 0) {
        return
      }
    }

    let url: string = videoFiles[0].fileUrl

    if (videoFileToken != null) {
      url = addQueryParams(url, { videoFileToken })
    }

    this.source = url

    console.log(url)
  }
  // End Section - Select From Frame

  // Section - Helpers

  private handleGlobalError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
    if (!errorMessage) return

    this.notifier.error(errorMessage)
  }

  private async handleRequestError (err: any) {
    const errorBody = err.body as PeerTubeProblemDocument

    if (errorBody?.code === ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS && errorBody.originUrl) {
      const originUrl = errorBody.originUrl + (window.location.search ?? '')

      const res = await this.confirmService.confirm(
        // eslint-disable-next-line max-len
        $localize`This video is not available on this instance. Do you want to be redirected on the origin instance: <a href="${originUrl}">${originUrl}</a>?`,
        $localize`Redirection`
      )

      if (res === true) return window.location.href = originUrl
    }

    // If 400, 403 or 404, the video is private or blocked so redirect to 404
    return this.restExtractor.redirectTo404IfNotFound(err, 'video', [
      HttpStatusCode.BAD_REQUEST_400,
      HttpStatusCode.FORBIDDEN_403,
      HttpStatusCode.NOT_FOUND_404
    ])
  }

  // End Section - Helpers
}
