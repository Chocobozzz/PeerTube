import { CommonModule } from '@angular/common'
import { Component, input, output } from '@angular/core'
import { AlertComponent } from '../shared-main/common/alert.component'
import { ProgressBarComponent } from '../shared-main/common/progress-bar.component'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ],
  imports: [ CommonModule, ProgressBarComponent, AlertComponent ]
})
export class UploadProgressComponent {
  readonly isUploading = input<boolean>(undefined)
  readonly uploadPercents = input<number>(undefined)
  readonly error = input<string>(undefined)
  readonly uploaded = input<boolean>(undefined)
  readonly enableRetryAfterError = input<boolean>(undefined)

  readonly cancelUpload = output()
  readonly retry = output()

  getUploadingLabel () {
    const uploadPercents = this.uploadPercents()
    if (uploadPercents === 100 && this.uploaded() === false) {
      return $localize`Processing…`
    }

    return $localize`${uploadPercents}%`
  }
}
