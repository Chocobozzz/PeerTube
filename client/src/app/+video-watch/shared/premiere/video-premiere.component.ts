import { Component, EventEmitter, Input, Output } from '@angular/core'
import { NgIf, NgClass } from '@angular/common'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'

@Component({
  selector: 'my-video-premiere',
  templateUrl: './video-premiere.component.html',
  styleUrls: [ './video-premiere.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    NgClass,
    GlobalIconComponent,
    PTDatePipe
  ]
})
export class VideoPremiereComponent {
  @Input() video: VideoDetails
  @Input() theaterEnabled = false

  @Output() remindMeClick = new EventEmitter<void>()

  notificationAdded = false

  onRemindMe () {
    if (this.notificationAdded) return

    this.notificationAdded = true
    this.remindMeClick.emit()
  }
}
