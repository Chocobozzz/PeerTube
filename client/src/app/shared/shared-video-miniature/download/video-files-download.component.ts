import { KeyValuePipe, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, EventEmitter, Inject, Input, LOCALE_ID, OnInit, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import {
  NgbCollapse,
  NgbNavModule,
  NgbTooltip
} from '@ng-bootstrap/ng-bootstrap'
import { objectKeysTyped, pick } from '@peertube/peertube-core-utils'
import { VideoFile, VideoFileMetadata, VideoSource } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { videoRequiresFileToken } from '@root-helpers/video'
import { mapValues } from 'lodash-es'
import { firstValueFrom } from 'rxjs'
import { tap } from 'rxjs/operators'
import { InputTextComponent } from '../../shared-forms/input-text.component'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { BytesPipe } from '../../shared-main/common/bytes.pipe'
import { NumberFormatterPipe } from '../../shared-main/common/number-formatter.pipe'
import { VideoDetails } from '../../shared-main/video/video-details.model'
import { VideoService } from '../../shared-main/video/video.service'

type FileMetadata = { [key: string]: { label: string, value: string | number } }

@Component({
  selector: 'my-video-files-download',
  templateUrl: './video-files-download.component.html',
  styleUrls: [ './video-files-download.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    GlobalIconComponent,
    NgFor,
    NgbNavModule,
    InputTextComponent,
    NgbCollapse,
    KeyValuePipe,
    NgbTooltip,
    NgTemplateOutlet,
    AlertComponent
  ]
})
export class VideoFilesDownloadComponent implements OnInit {
  @Input({ required: true }) video: VideoDetails
  @Input() originalVideoFile: VideoSource
  @Input() videoFileToken: string

  @Output() downloaded = new EventEmitter<void>()

  downloadType: 'direct' | 'torrent' = 'direct'

  activeResolutionId: number | 'original' = -1

  videoFileMetadataFormat: FileMetadata
  videoFileMetadataVideoStream: FileMetadata | undefined
  videoFileMetadataAudioStream: FileMetadata | undefined

  isAdvancedCustomizationCollapsed = true

  private bytesPipe: BytesPipe
  private numbersPipe: NumberFormatterPipe

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private videoService: VideoService
  ) {
    this.bytesPipe = new BytesPipe()
    this.numbersPipe = new NumberFormatterPipe(this.localeId)
  }

  ngOnInit () {

    if (this.hasFiles()) {
      this.onResolutionIdChange(this.getVideoFiles()[0].resolution.id)
    }
  }

  getVideoFiles () {
    if (!this.video) return []
    if (this.video.files.length !== 0) return this.video.files

    const hls = this.video.getHlsPlaylist()
    if (hls) return hls.files

    return []
  }

  // ---------------------------------------------------------------------------

  download () {
    window.location.assign(this.getVideoFileLink())

    this.downloaded.emit()
  }

  // ---------------------------------------------------------------------------

  async onResolutionIdChange (resolutionId: number | 'original') {
    this.activeResolutionId = resolutionId

    let metadata: VideoFileMetadata

    if (this.activeResolutionId === 'original') {
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

  // ---------------------------------------------------------------------------

  hasFiles () {
    return this.getVideoFiles().length !== 0
  }

  getVideoFile () {
    if (this.activeResolutionId === 'original') return undefined

    const file = this.getVideoFiles()
      .find(f => f.resolution.id === this.activeResolutionId)

    if (!file) {
      logger.error(`Could not find file with resolution ${this.activeResolutionId}`)
      return undefined
    }

    return file
  }

  getVideoFileLink () {
    const suffix = this.activeResolutionId === 'original' || this.isConfidentialVideo()
      ? '?videoFileToken=' + this.videoFileToken
      : ''

    if (this.activeResolutionId === 'original') {
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

  // ---------------------------------------------------------------------------

  isConfidentialVideo () {
    return this.activeResolutionId === 'original' || videoRequiresFileToken(this.video)
  }

  // ---------------------------------------------------------------------------

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
