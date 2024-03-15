import { KeyValuePipe, NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, Inject, Input, LOCALE_ID, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, HooksService } from '@app/core'
import {
  NgbCollapse,
  NgbModal,
  NgbModalRef,
  NgbNav,
  NgbNavContent,
  NgbNavItem,
  NgbNavLink,
  NgbNavLinkBase,
  NgbNavOutlet,
  NgbTooltip
} from '@ng-bootstrap/ng-bootstrap'
import { objectKeysTyped, pick } from '@peertube/peertube-core-utils'
import { VideoCaption, VideoFile, VideoFileMetadata, VideoSource } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { videoRequiresFileToken } from '@root-helpers/video'
import { mapValues } from 'lodash-es'
import { firstValueFrom, of } from 'rxjs'
import { tap } from 'rxjs/operators'
import { InputTextComponent } from '../shared-forms/input-text.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { BytesPipe } from '../shared-main/angular/bytes.pipe'
import { NumberFormatterPipe } from '../shared-main/angular/number-formatter.pipe'
import { VideoDetails } from '../shared-main/video/video-details.model'
import { VideoFileTokenService } from '../shared-main/video/video-file-token.service'
import { VideoService } from '../shared-main/video/video.service'

type DownloadType = 'video' | 'subtitles'
type FileMetadata = { [key: string]: { label: string, value: string | number } }

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    GlobalIconComponent,
    NgbNav,
    NgFor,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    InputTextComponent,
    NgbNavOutlet,
    NgbCollapse,
    KeyValuePipe,
    NgbTooltip,
    NgTemplateOutlet,
    NgClass
  ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Input() videoPassword: string

  downloadType: 'direct' | 'torrent' = 'direct'

  resolutionId: number | 'original' = -1
  subtitleLanguageId: string

  videoFileMetadataFormat: FileMetadata
  videoFileMetadataVideoStream: FileMetadata | undefined
  videoFileMetadataAudioStream: FileMetadata | undefined

  isAdvancedCustomizationCollapsed = true

  type: DownloadType = 'video'

  videoFileToken: string

  originalVideoFile: VideoSource

  loaded = false

  private activeModal: NgbModalRef

  private bytesPipe: BytesPipe
  private numbersPipe: NumberFormatterPipe

  private video: VideoDetails
  private videoCaptions: VideoCaption[]

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private modalService: NgbModal,
    private authService: AuthService,
    private videoService: VideoService,
    private videoFileTokenService: VideoFileTokenService,
    private hooks: HooksService
  ) {
    this.bytesPipe = new BytesPipe()
    this.numbersPipe = new NumberFormatterPipe(this.localeId)
  }

  get typeText () {
    return this.type === 'video'
      ? $localize`video`
      : $localize`subtitles`
  }

  getVideoFiles () {
    if (!this.video) return []

    return this.video.getFiles()
  }

  getCaptions () {
    if (!this.videoCaptions) return []

    return this.videoCaptions
  }

  show (video: VideoDetails, videoCaptions?: VideoCaption[]) {
    this.loaded = false

    this.videoFileToken = undefined
    this.originalVideoFile = undefined

    this.video = video
    this.videoCaptions = videoCaptions

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    if (this.hasFiles()) {
      this.onResolutionIdChange(this.getVideoFiles()[0].resolution.id)
    }

    if (this.hasCaptions()) {
      this.subtitleLanguageId = this.videoCaptions[0].language.id
    }

    this.getOriginalVideoFileObs()
      .subscribe(source => {
        if (source?.fileDownloadUrl) {
          this.originalVideoFile = source
        }

        if (this.originalVideoFile || this.isConfidentialVideo()) {
          this.videoFileTokenService.getVideoFileToken({ videoUUID: this.video.uuid, videoPassword: this.videoPassword })
            .subscribe(({ token }) => {
              this.videoFileToken = token

              this.loaded = true
            })
        } else {
          this.loaded = true
        }
      })

    this.activeModal.shown.subscribe(() => {
      this.hooks.runAction('action:modal.video-download.shown', 'common')
    })
  }

  private getOriginalVideoFileObs () {
    if (!this.authService.isLoggedIn()) return of(undefined)
    const user = this.authService.getUser()

    if (!this.video.isOwnerOrHasSeeAllVideosRight(user)) return of(undefined)

    return this.videoService.getSource(this.video.id)
  }

  // ---------------------------------------------------------------------------

  onClose () {
    this.video = undefined
    this.videoCaptions = undefined
  }

  download () {
    window.location.assign(this.getLink())

    this.activeModal.close()
  }

  getLink () {
    return this.type === 'subtitles' && this.videoCaptions
      ? this.getCaptionLink()
      : this.getVideoFileLink()
  }

  async onResolutionIdChange (resolutionId: number | 'original') {
    this.resolutionId = resolutionId

    let metadata: VideoFileMetadata

    if (this.resolutionId === 'original') {
      metadata = this.originalVideoFile.metadata
    } else {
      const videoFile = this.getVideoFile()
      if (!videoFile) return

      if (!videoFile.metadata && videoFile.metadataUrl) {
        await this.hydrateMetadataFromMetadataUrl(videoFile)
      }

      metadata = videoFile.metadata
    }

    if (!metadata) return

    this.videoFileMetadataFormat = this.getMetadataFormat(metadata.format)
    this.videoFileMetadataVideoStream = this.getMetadataStream(metadata.streams, 'video')
    this.videoFileMetadataAudioStream = this.getMetadataStream(metadata.streams, 'audio')
  }

  onSubtitleIdChange (subtitleId: string) {
    this.subtitleLanguageId = subtitleId
  }

  hasFiles () {
    return this.getVideoFiles().length !== 0
  }

  getVideoFile () {
    if (this.resolutionId === 'original') return undefined

    const file = this.getVideoFiles()
      .find(f => f.resolution.id === this.resolutionId)

    if (!file) {
      logger.error(`Could not find file with resolution ${this.resolutionId}`)
      return undefined
    }

    return file
  }

  getVideoFileLink () {
    const suffix = this.resolutionId === 'original' || this.isConfidentialVideo()
      ? '?videoFileToken=' + this.videoFileToken
      : ''

    if (this.resolutionId === 'original') {
      return this.originalVideoFile.fileDownloadUrl + suffix
    }

    const file = this.getVideoFile()
    if (!file) return ''

    switch (this.downloadType) {
      case 'direct':
        return file.fileDownloadUrl + suffix

      case 'torrent':
        return file.torrentDownloadUrl + suffix
    }
  }

  hasCaptions () {
    return this.getCaptions().length !== 0
  }

  getCaption () {
    const caption = this.getCaptions()
      .find(c => c.language.id === this.subtitleLanguageId)

    if (!caption) {
      logger.error(`Cannot find caption ${this.subtitleLanguageId}`)
      return undefined
    }

    return caption
  }

  getCaptionLink () {
    const caption = this.getCaption()
    if (!caption) return ''

    return window.location.origin + caption.captionPath
  }

  isConfidentialVideo () {
    return this.resolutionId === 'original' || videoRequiresFileToken(this.video)
  }

  switchToType (type: DownloadType) {
    this.type = type
  }

  hasMetadata () {
    return !!this.videoFileMetadataFormat
  }

  private getMetadataFormat (format: any) {
    const keyToTranslateFunction = {
      encoder: (value: string) => ({ label: $localize`Encoder`, value }),
      format_long_name: (value: string) => ({ label: $localize`Format name`, value }),
      size: (value: number | string) => ({ label: $localize`Size`, value: this.bytesPipe.transform(+value, 2) }),
      bit_rate: (value: number | string) => ({
        label: $localize`Bitrate`,
        value: `${this.numbersPipe.transform(+value)}bps`
      })
    }

    // flattening format
    const sanitizedFormat = Object.assign(format, format.tags)
    delete sanitizedFormat.tags

    return mapValues(
      pick(sanitizedFormat, objectKeysTyped(keyToTranslateFunction)),
      (val: string, key: keyof typeof keyToTranslateFunction) => keyToTranslateFunction[key](val)
    )
  }

  private getMetadataStream (streams: any[], type: 'video' | 'audio') {
    const stream = streams.find(s => s.codec_type === type)
    if (!stream) return undefined

    let keyToTranslateFunction = {
      codec_long_name: (value: string) => ({ label: $localize`Codec`, value }),
      profile: (value: string) => ({ label: $localize`Profile`, value }),
      bit_rate: (value: number | string) => ({
        label: $localize`Bitrate`,
        value: isNaN(+value)
          ? undefined
          : `${this.numbersPipe.transform(+value)}bps`
      })
    }

    if (type === 'video') {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        width: (value: string | number) => ({ label: $localize`Resolution`, value: `${value}x${stream.height}` }),
        display_aspect_ratio: (value: string) => ({ label: $localize`Aspect ratio`, value }),
        avg_frame_rate: (value: string) => ({ label: $localize`Average frame rate`, value }),
        pix_fmt: (value: string) => ({ label: $localize`Pixel format`, value })
      })
    } else {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        sample_rate: (value: string | number) => ({ label: $localize`Sample rate`, value }),
        channel_layout: (value: string | number) => ({ label: $localize`Channel Layout`, value })
      })
    }

    return mapValues(
      pick(stream, Object.keys(keyToTranslateFunction)),
      (val: string, key: keyof typeof keyToTranslateFunction) => keyToTranslateFunction[key](val)
    )
  }

  private hydrateMetadataFromMetadataUrl (file: VideoFile) {
    const observable = this.videoService.getVideoFileMetadata(file.metadataUrl)
      .pipe(tap(res => file.metadata = res))

    return firstValueFrom(observable)
  }
}
