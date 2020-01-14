import { Component, ElementRef, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AuthService, Notifier } from '@app/core'
import { VideoPrivacy, VideoCaption, VideoFile } from '@shared/models'
import { FfprobeFormat, FfprobeStream } from 'fluent-ffmpeg'
import { mapValues, pick } from 'lodash-es'
import { NumberFormatterPipe } from '@app/shared/angular/number-formatter.pipe'

type DownloadType = 'video' | 'subtitles'

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
  videoFileMetadataFormat: { [key: string]: { label: string, value: string }}
  videoFileMetadataVideoStream: { [key: string]: { label: string, value: string }} | undefined
  videoFileMetadataAudioStream: { [key: string]: { label: string, value: string }} | undefined
  videoCaptions: VideoCaption[]
  activeModal: NgbActiveModal

  type: DownloadType = 'video'

  constructor (
    private notifier: Notifier,
    private modalService: NgbModal,
    private auth: AuthService,
    private i18n: I18n
  ) { }

  get typeText () {
    return this.type === 'video'
      ? this.i18n('video')
      : this.i18n('subtitles')
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

  onResolutionIdChange () {
    this.videoFile = this.getVideoFile()
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
    this.notifier.success(this.i18n('Copied'))
  }

  switchToType (type: DownloadType) {
    this.type = type
  }

  getMetadataFormat (format: FfprobeFormat) {
    const keyToTranslateFunction = {
      'encoder': (value: any) => ({ label: this.i18n('Encoder'), value }),
      'format_long_name': (value: any) => ({ label: this.i18n('Format name'), value }),
      'size': (value: any) => ({ label: this.i18n('Size'), value: new NumberFormatterPipe().transform(value) }),
      'bit_rate': (value: any) => ({
        label: this.i18n('Bitrate'),
        value: `${new NumberFormatterPipe().transform(value)}bit/sec`
      })
    }

    // flattening format
    format = Object.assign(format, format.tags)
    delete format.tags

    return mapValues(
      pick(format, Object.keys(keyToTranslateFunction)),
      (val, key) => keyToTranslateFunction[key](val)
    )
  }

  getMetadataStream (streams: FfprobeStream[], type: 'video' | 'audio') {
    const stream = streams.find(s => s.codec_type === type) || undefined
    if (!stream) return undefined

    let keyToTranslateFunction = {
      'codec_long_name': (value: any) => ({ label: this.i18n('Codec'), value }),
      'profile': (value: any) => ({ label: this.i18n('Profile'), value }),
    }

    if (type === 'video') {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        'width': (value: any) => ({ label: this.i18n('Resolution'), value: `${value}x${stream.height}` }),
        'display_aspect_ratio': (value: any) => ({ label: this.i18n('Aspect ratio'), value }),
        'avg_frame_rate': (value: any) => ({ label: this.i18n('Average frame rate'), value }),
        'pix_fmt': (value: any) => ({ label: this.i18n('Pixel format'), value })
      })
    } else {
      keyToTranslateFunction = Object.assign(keyToTranslateFunction, {
        'sample_rate': (value: any) => ({ label: this.i18n('Sample rate'), value }),
        'channel_layout': (value: any) => ({ label: this.i18n('Channel Layout'), value })
      })
    }

    return mapValues(
      pick(stream, Object.keys(keyToTranslateFunction)),
      (val, key) => keyToTranslateFunction[key](val)
    )
  }
}
