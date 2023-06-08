import { mapValues } from 'lodash-es'
import { firstValueFrom } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Component, ElementRef, Inject, Input, LOCALE_ID, ViewChild } from '@angular/core'
import { HooksService } from '@app/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { videoRequiresFileToken } from '@root-helpers/video'
import { objectKeysTyped, pick } from '@shared/core-utils'
import { VideoCaption, VideoFile } from '@shared/models'
import { BytesPipe, NumberFormatterPipe, VideoDetails, VideoFileTokenService, VideoService } from '../shared-main'

type DownloadType = 'video' | 'subtitles'
type FileMetadata = { [key: string]: { label: string, value: string | number } }

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Input() videoPassword: string

  downloadType: 'direct' | 'torrent' = 'direct'

  resolutionId: number | string = -1
  subtitleLanguageId: string

  videoFileMetadataFormat: FileMetadata
  videoFileMetadataVideoStream: FileMetadata | undefined
  videoFileMetadataAudioStream: FileMetadata | undefined

  isAdvancedCustomizationCollapsed = true

  type: DownloadType = 'video'

  videoFileToken: string

  private activeModal: NgbModalRef

  private bytesPipe: BytesPipe
  private numbersPipe: NumberFormatterPipe

  private video: VideoDetails
  private videoCaptions: VideoCaption[]

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private modalService: NgbModal,
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
    this.videoFileToken = undefined

    this.video = video
    this.videoCaptions = videoCaptions

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    if (this.hasFiles()) {
      this.onResolutionIdChange(this.getVideoFiles()[0].resolution.id)
    }

    if (this.hasCaptions()) {
      this.subtitleLanguageId = this.videoCaptions[0].language.id
    }

    if (this.isConfidentialVideo()) {
      this.videoFileTokenService.getVideoFileToken({ videoUUID: this.video.uuid, videoPassword: this.videoPassword })
        .subscribe(({ token }) => this.videoFileToken = token)
    }

    this.activeModal.shown.subscribe(() => {
      this.hooks.runAction('action:modal.video-download.shown', 'common')
    })
  }

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

  async onResolutionIdChange (resolutionId: number) {
    this.resolutionId = resolutionId

    const videoFile = this.getVideoFile()

    if (!videoFile.metadata) {
      if (!videoFile.metadataUrl) return

      await this.hydrateMetadataFromMetadataUrl(videoFile)
    }

    if (!videoFile.metadata) return

    this.videoFileMetadataFormat = videoFile
      ? this.getMetadataFormat(videoFile.metadata.format)
      : undefined
    this.videoFileMetadataVideoStream = videoFile
      ? this.getMetadataStream(videoFile.metadata.streams, 'video')
      : undefined
    this.videoFileMetadataAudioStream = videoFile
      ? this.getMetadataStream(videoFile.metadata.streams, 'audio')
      : undefined
  }

  onSubtitleIdChange (subtitleId: string) {
    this.subtitleLanguageId = subtitleId
  }

  hasFiles () {
    return this.getVideoFiles().length !== 0
  }

  getVideoFile () {
    const file = this.getVideoFiles()
                     .find(f => f.resolution.id === this.resolutionId)

    if (!file) {
      logger.error(`Could not find file with resolution ${this.resolutionId}`)
      return undefined
    }

    return file
  }

  getVideoFileLink () {
    const file = this.getVideoFile()
    if (!file) return ''

    const suffix = this.isConfidentialVideo()
      ? '?videoFileToken=' + this.videoFileToken
      : ''

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
    return videoRequiresFileToken(this.video)

  }

  switchToType (type: DownloadType) {
    this.type = type
  }

  getFileMetadata () {
    const file = this.getVideoFile()
    if (!file) return undefined

    return file.metadata
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
        value: `${this.numbersPipe.transform(+value)}bps`
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
