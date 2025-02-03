import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AlertComponent } from '../shared-main/common/alert.component'
import { ProgressBarComponent } from '../shared-main/common/progress-bar.component'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ],
  imports: [ CommonModule, ProgressBarComponent, AlertComponent ]
})
export class UploadProgressComponent {
  @Input() isUploading: boolean
  @Input() uploadPercents: number
  @Input() error: string
  @Input() uploaded: boolean
  @Input() enableRetryAfterError: boolean

  @Output() cancelUpload = new EventEmitter()
  @Output() retry = new EventEmitter()

  getUploadingLabel () {
    if (this.uploadPercents === 100 && this.uploaded === false) {
      return $localize`Processing…`
    }

    return $localize`${this.uploadPercents}%`
  }
}
