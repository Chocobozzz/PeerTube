import { Component, ViewChild } from '@angular/core'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { VideoImportComponent } from '@app/videos/+video-edit/video-import.component'
import { VideoUploadComponent } from '@app/videos/+video-edit/video-upload.component'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [ './video-add.component.scss' ]
})
export class VideoAddComponent implements CanComponentDeactivate {
  @ViewChild('videoUpload') videoUpload: VideoUploadComponent
  @ViewChild('videoImport') videoImport: VideoImportComponent

  secondStepType: 'upload' | 'import'
  videoName: string

  constructor (
    private serverService: ServerService
  ) {}

  onFirstStepDone (type: 'upload' | 'import', videoName: string) {
    this.secondStepType = type
    this.videoName = videoName
  }

  canDeactivate () {
    if (this.secondStepType === 'upload') return this.videoUpload.canDeactivate()
    if (this.secondStepType === 'import') return this.videoImport.canDeactivate()

    return { canDeactivate: true }
  }

  isVideoImportEnabled () {
    return this.serverService.getConfig().import.videos.http.enabled
  }
}
