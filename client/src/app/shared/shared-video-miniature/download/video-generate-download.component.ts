import { NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { getResolutionAndFPSLabel, maxBy } from '@peertube/peertube-core-utils'
import { VideoFile, VideoResolution, VideoSource } from '@peertube/peertube-models'
import { videoRequiresFileToken } from '@root-helpers/video'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { BytesPipe } from '../../shared-main/common/bytes.pipe'
import { VideoDetails } from '../../shared-main/video/video-details.model'

@Component({
  selector: 'my-video-generate-download',
  templateUrl: './video-generate-download.component.html',
  styleUrls: [ './video-generate-download.component.scss' ],
  imports: [
    NgIf,
    FormsModule,
    GlobalIconComponent,
    PeertubeCheckboxComponent,
    NgbTooltip,
    BytesPipe
  ]
})
export class VideoGenerateDownloadComponent implements OnInit {
  @Input({ required: true }) video: VideoDetails
  @Input() originalVideoFile: VideoSource
  @Input() videoFileToken: string

  @Output() downloaded = new EventEmitter<void>()

  includeAudio = true
  videoFileChosen = ''
  videoFiles: VideoFile[]

  constructor (private videoService: VideoService) {
  }

  ngOnInit () {
    this.videoFiles = this.buildVideoFiles()
    if (this.videoFiles.length === 0) return

    this.videoFileChosen = 'file-' + maxBy(this.videoFiles, 'resolution').id
  }

  getLabel (file: VideoFile) {
    return getResolutionAndFPSLabel(file.resolution.label, file.fps)
  }

  getFileSize (file: VideoFile) {
    if (file.hasAudio && file.hasVideo) return file.size
    if (file.hasAudio) return file.size

    if (this.includeAudio) {
      const audio = this.findAudioFileOnly()

      return file.size + (audio?.size || 0)
    }

    return file.size
  }

  hasAudioSplitted () {
    if (this.videoFileChosen === 'file-original') return false

    return this.findCurrentFile().hasAudio === false &&
      this.videoFiles.some(f => f.hasVideo === false && f.hasAudio === true)
  }

  // ---------------------------------------------------------------------------

  download () {
    window.location.assign(this.getVideoFileLink())

    this.downloaded.emit()
  }

  // ---------------------------------------------------------------------------

  getVideoFileLink () {
    const suffix = this.videoFileChosen === 'file-original' || this.isConfidentialVideo()
      ? '?videoFileToken=' + this.videoFileToken
      : ''

    if (this.videoFileChosen === 'file-original') {
      return this.originalVideoFile.fileDownloadUrl + suffix
    }

    const file = this.findCurrentFile()
    if (!file) return ''

    const files = [ file ]

    if (this.hasAudioSplitted() && this.includeAudio) {
      files.push(this.findAudioFileOnly())
    }

    return this.videoService.generateDownloadUrl({ video: this.video, videoFileToken: this.videoFileToken, files })
  }

  // ---------------------------------------------------------------------------

  isConfidentialVideo () {
    return this.videoFileChosen === 'file-original' || videoRequiresFileToken(this.video)
  }

  // ---------------------------------------------------------------------------

  private buildVideoFiles () {
    if (!this.video) return []

    const hls = this.video.getHlsPlaylist()
    if (hls) return hls.files

    return this.video.files
  }

  private findCurrentFile () {
    return this.videoFiles.find(f => this.videoFileChosen === 'file-' + f.id)
  }

  private findAudioFileOnly () {
    return this.videoFiles.find(f => f.resolution.id === VideoResolution.H_NOVIDEO)
  }
}
