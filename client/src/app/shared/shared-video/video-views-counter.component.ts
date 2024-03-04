import { Component, Input } from '@angular/core'
import { Video } from '../shared-main'
import { NumberFormatterPipe } from '../shared-main/angular/number-formatter.pipe'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-video-views-counter',
  styleUrls: [ './video-views-counter.component.scss' ],
  templateUrl: './video-views-counter.component.html',
  standalone: true,
  imports: [ NgIf, NumberFormatterPipe ]
})
export class VideoViewsCounterComponent {
  @Input() video: Video
}
