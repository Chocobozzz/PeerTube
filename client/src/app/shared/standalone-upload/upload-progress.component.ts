import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  selector: 'my-upload-progress',
  templateUrl: './upload-progress.component.html',
  styleUrls: [ './upload-progress.component.scss' ],
  imports: [ CommonModule ],
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
}
