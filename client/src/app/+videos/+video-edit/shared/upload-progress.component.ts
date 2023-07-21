import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ]
})
export class UploadProgressComponent {
  @Input() isUploadingVideo: boolean
  @Input() videoUploadPercents: number
  @Input() error: string
  @Input() videoUploaded: boolean
  @Input() enableRetryAfterError: boolean

  @Output() cancel = new EventEmitter()
  @Output() retry = new EventEmitter()
}
