import { Component, ViewChild } from '@angular/core'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { VideoImportUrlComponent } from '@app/videos/+video-edit/video-import-url.component'
import { VideoUploadComponent } from '@app/videos/+video-edit/video-upload.component'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [ './video-add.component.scss' ]
})
export class VideoAddComponent implements CanComponentDeactivate {
  @ViewChild('videoUpload') videoUpload: VideoUploadComponent
  @ViewChild('videoImportUrl') videoImportUrl: VideoImportUrlComponent

  secondStepType: 'upload' | 'import-url'
  videoName: string

  constructor (
    private serverService: ServerService
  ) {}

  onFirstStepDone (type: 'upload' | 'import-url', videoName: string) {
    this.secondStepType = type
    this.videoName = videoName
  }

  canDeactivate () {
    if (this.secondStepType === 'upload') return this.videoUpload.canDeactivate()
    if (this.secondStepType === 'import-url') return this.videoImportUrl.canDeactivate()

    return { canDeactivate: true }
  }

  isVideoImportEnabled () {
    return this.serverService.getConfig().import.videos.http.enabled
  }
}
