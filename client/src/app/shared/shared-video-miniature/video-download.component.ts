import { mapValues, pick } from 'lodash-es'
import { tap } from 'rxjs/operators'
import { Component, ElementRef, Inject, LOCALE_ID, ViewChild } from '@angular/core'
import { AuthService, HooksService, Notifier } from '@app/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption, VideoFile, VideoPrivacy } from '@shared/models'
import { BytesPipe, NumberFormatterPipe, VideoDetails, VideoService } from '../shared-main'

type DownloadType = 'video' | 'subtitles'
type FileMetadata = { [key: string]: { label: string, value: string }}

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  downloadType: 'direct' | 'torrent' = 'direct'

  resolutionId: number | string = -1
  subtitleLanguageId: string

  videoFileMetadataFormat: FileMetadata
  videoFileMetadataVideoStream: FileMetadata | undefined
  videoFileMetadataAudioStream: FileMetadata | undefined

  isAdvancedCustomizationCollapsed = true

  type: DownloadType = 'video'

  private activeModal: NgbModalRef

  private bytesPipe: BytesPipe
  private numbersPipe: NumberFormatterPipe

  private video: VideoDetails
  private videoCaptions: VideoCaption[]

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private notifier: Notifier,
    private modalService: NgbModal,
    private videoService: VideoService,
    private auth: AuthService,
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
    this.video = video
    this.videoCaptions = videoCaptions

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    if (this.hasFiles()) {
      this.onResolutionIdChange(this.getVideoFiles()[0].resolution.id)
    }

    if (this.hasCaptions()) {
      this.subtitleLanguageId = this.videoCaptions[0].language.id
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
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return undefined
    }

    return file
  }

  getVideoFileLink () {
    const file = this.getVideoFile()
    if (!file) return ''

    const suffix = this.isConfidentialVideo()
      ? '?access_token=' + this.auth.getAccessToken()
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
      console.error('Cannot find caption %s.', this.subtitleLanguageId)
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
    return this.video.privacy.id === VideoPrivacy.PRIVATE || this.video.privacy.id === VideoPrivacy.INTERNAL
  }

  activateCopiedMessage () {
    this.notifier.success($localize`Copied`)
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
      'encoder': (value: string) => ({ label: $localize`Encoder`, value }),
      'format_long_name': (value: string) => ({ label: $localize`Format name`, value }),
      'size': (value: number) => ({ label: $localize`Size`, value: this.bytesPipe.transform(value, 2) }),
      'bit_rate': (value: number) => ({
        label: $localize`Bitrate`,
        value: `${this.numbersPipe.transform(value)}bps`
      })
    }

    // flattening format
    const sanitizedFormat = Object.assign(format, format.tags)
    delete sanitizedFormat.tags

    return mapValues(
      pick(sanitizedFormat, Object.keys(keyToTranslateFunction)),
      (val, key) => keyToTranslateFunction[key](val)
    )
  }

  private getMetadataStream (streams: any[], type: 'video' | 'audio') {
    const stream = streams.find(s => s.codec_type === type)
    if (!stream) return undefined

    let keyToTranslateFunction = {
      'codec_long_name': (value: string) => ({ label: $localize`Codec`, value }),
      'profile': (value: string) => ({ label: $localize`Profile`, value }),
      'bit_rate': (value: number) => ({
        label: $localize`Bitrate`,
        value: `${this.numbersPipe.transform(value)}bps`
      })
    }

    if (type === 'video') {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        'width': (value: number) => ({ label: $localize`Resolution`, value: `${value}x${stream.height}` }),
        'display_aspect_ratio': (value: string) => ({ label: $localize`Aspect ratio`, value }),
        'avg_frame_rate': (value: string) => ({ label: $localize`Average frame rate`, value }),
        'pix_fmt': (value: string) => ({ label: $localize`Pixel format`, value })
      })
    } else {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        'sample_rate': (value: number) => ({ label: $localize`Sample rate`, value }),
        'channel_layout': (value: number) => ({ label: $localize`Channel Layout`, value })
      })
    }

    return mapValues(
      pick(stream, Object.keys(keyToTranslateFunction)),
      (val, key) => keyToTranslateFunction[key](val)
    )
  }

  private hydrateMetadataFromMetadataUrl (file: VideoFile) {
    const observable = this.videoService.getVideoFileMetadata(file.metadataUrl)
      .pipe(tap(res => file.metadata = res))

    return observable.toPromise()
  }
}
