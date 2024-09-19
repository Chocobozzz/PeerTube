import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { ProgressBarComponent } from '../shared-main/misc/progress-bar.component'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ],
  imports: [ CommonModule, ProgressBarComponent ],
  standalone: true
})
export class UploadProgressComponent {
  @Input() isUploading: boolean
  @Input() uploadPercents: number
  @Input() error: string
  @Input() uploaded: boolean
  @Input() enableRetryAfterError: boolean

  @Output() cancel = new EventEmitter()
  @Output() retry = new EventEmitter()

  getUploadingLabel () {
    if (this.uploadPercents === 100 && this.uploaded === false) {
      return $localize`Processing…`
    }

    return $localize`${this.uploadPercents}%`
  }
}
