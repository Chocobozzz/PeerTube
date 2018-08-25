import { Component, ViewChild } from '@angular/core'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { VideoImportUrlComponent } from '@app/videos/+video-edit/video-add-components/video-import-url.component'
import { VideoUploadComponent } from '@app/videos/+video-edit/video-add-components/video-upload.component'
import { ServerService } from '@app/core'
import { VideoImportTorrentComponent } from '@app/videos/+video-edit/video-add-components/video-import-torrent.component'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [ './video-add.component.scss' ]
})
export class VideoAddComponent implements CanComponentDeactivate {
  @ViewChild('videoUpload') videoUpload: VideoUploadComponent
  @ViewChild('videoImportUrl') videoImportUrl: VideoImportUrlComponent
  @ViewChild('videoImportTorrent') videoImportTorrent: VideoImportTorrentComponent

  secondStepType: 'upload' | 'import-url' | 'import-torrent'
  videoName: string

  constructor (
    private serverService: ServerService
  ) {}

  onFirstStepDone (type: 'upload' | 'import-url' | 'import-torrent', videoName: string) {
    this.secondStepType = type
    this.videoName = videoName
  }

  canDeactivate () {
    if (this.secondStepType === 'upload') return this.videoUpload.canDeactivate()
    if (this.secondStepType === 'import-url') return this.videoImportUrl.canDeactivate()
    if (this.secondStepType === 'import-torrent') return this.videoImportTorrent.canDeactivate()

    return { canDeactivate: true }
  }

  isVideoImportHttpEnabled () {
    return this.serverService.getConfig().import.videos.http.enabled
  }

  isVideoImportTorrentEnabled () {
    return this.serverService.getConfig().import.videos.torrent.enabled
  }
}
