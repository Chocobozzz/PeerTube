import { Component, input, output } from '@angular/core'
import { AlertComponent } from '../shared-main/common/alert.component'
import { ProgressBarComponent } from '../shared-main/common/progress-bar.component'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ],
  imports: [ ProgressBarComponent, AlertComponent ]
})
export class UploadProgressComponent {
  readonly isUploading = input<boolean>(undefined)
  readonly uploadPercents = input<number>(undefined)
  readonly error = input<string>(undefined)
  readonly uploaded = input<boolean>(undefined)
  readonly enableRetryAfterError = input<boolean>(undefined)
  readonly uploadedLabel = input<string>()

  readonly retry = output()

  getUploadingLabel () {
    if (this.uploaded()) return this.uploadedLabel() || $localize`File uploaded!`

    const uploadPercents = this.uploadPercents()
    if (uploadPercents === 100) return $localize`Processing…`

    return $localize`${uploadPercents}%`
  }
}
