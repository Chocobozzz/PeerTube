import { mapValues, pick } from 'lodash-es'
import { Component, ElementRef, Inject, LOCALE_ID, ViewChild } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
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

  downloadType: 'direct' | 'torrent' = 'torrent'
  resolutionId: number | string = -1
  subtitleLanguageId: string

  video: VideoDetails
  videoFile: VideoFile
  videoFileMetadataFormat: FileMetadata
  videoFileMetadataVideoStream: FileMetadata | undefined
  videoFileMetadataAudioStream: FileMetadata | undefined
  videoCaptions: VideoCaption[]
  activeModal: NgbActiveModal

  type: DownloadType = 'video'

  private bytesPipe: BytesPipe
  private numbersPipe: NumberFormatterPipe

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private notifier: Notifier,
    private modalService: NgbModal,
    private videoService: VideoService,
    private auth: AuthService
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

  show (video: VideoDetails, videoCaptions?: VideoCaption[]) {
    this.video = video
    this.videoCaptions = videoCaptions && videoCaptions.length ? videoCaptions : undefined

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    this.resolutionId = this.getVideoFiles()[0].resolution.id
    this.onResolutionIdChange()
    if (this.videoCaptions) this.subtitleLanguageId = this.videoCaptions[0].language.id
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
      ? this.getSubtitlesLink()
      : this.getVideoFileLink()
  }

  async onResolutionIdChange () {
    this.videoFile = this.getVideoFile()
    if (this.videoFile.metadata || !this.videoFile.metadataUrl) return

    await this.hydrateMetadataFromMetadataUrl(this.videoFile)

    this.videoFileMetadataFormat = this.videoFile
      ? this.getMetadataFormat(this.videoFile.metadata.format)
      : undefined
    this.videoFileMetadataVideoStream = this.videoFile
      ? this.getMetadataStream(this.videoFile.metadata.streams, 'video')
      : undefined
    this.videoFileMetadataAudioStream = this.videoFile
      ? this.getMetadataStream(this.videoFile.metadata.streams, 'audio')
      : undefined
  }

  getVideoFile () {
    // HTML select send us a string, so convert it to a number
    this.resolutionId = parseInt(this.resolutionId.toString(), 10)

    const file = this.getVideoFiles().find(f => f.resolution.id === this.resolutionId)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return
    }
    return file
  }

  getVideoFileLink () {
    const file = this.videoFile
    if (!file) return

    const suffix = this.video.privacy.id === VideoPrivacy.PRIVATE || this.video.privacy.id === VideoPrivacy.INTERNAL
      ? '?access_token=' + this.auth.getAccessToken()
      : ''

    switch (this.downloadType) {
      case 'direct':
        return file.fileDownloadUrl + suffix

      case 'torrent':
        return file.torrentDownloadUrl + suffix
    }
  }

  getSubtitlesLink () {
    return window.location.origin + this.videoCaptions.find(caption => caption.language.id === this.subtitleLanguageId).captionPath
  }

  activateCopiedMessage () {
    this.notifier.success($localize`Copied`)
  }

  switchToType (type: DownloadType) {
    this.type = type
  }

  getMetadataFormat (format: any) {
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

  getMetadataStream (streams: any[], type: 'video' | 'audio') {
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
    observable.subscribe(res => file.metadata = res)

    return observable.toPromise()
  }
}
