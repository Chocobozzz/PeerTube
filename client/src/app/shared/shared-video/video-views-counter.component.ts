import { booleanAttribute, ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { formatICU } from '@app/helpers'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'

@Component({
  selector: 'my-video-views-counter',
  styleUrls: [ './video-views-counter.component.scss' ],
  templateUrl: './video-views-counter.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ NumberFormatterPipe ]
})
export class VideoViewsCounterComponent {
  @Input({ required: true, transform: booleanAttribute }) isLive: boolean
  @Input({ required: true }) viewers: number
  @Input({ required: true }) views: number

  getExactNumberOfViews () {
    if (this.isLive) {
      return formatICU($localize`{viewers, plural, =0 {No viewers} =1 {1 viewer} other {{viewers} viewers}}`, { viewers: this.viewers })
    }

    return formatICU($localize`{views, plural, =0 {No view} =1 {1 view} other {{views} views}}`, { views: this.views })
  }
}
