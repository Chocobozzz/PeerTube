import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core'
import { formatICU } from '@app/helpers'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'

@Component({
  selector: 'my-video-views-counter',
  styleUrls: [ './video-views-counter.component.scss' ],
  templateUrl: './video-views-counter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ NumberFormatterPipe ]
})
export class VideoViewsCounterComponent {
  readonly isLive = input.required<boolean, unknown>({ transform: booleanAttribute })
  readonly viewers = input.required<number>()
  readonly views = input.required<number>()

  getExactNumberOfViews () {
    if (this.isLive()) {
      return formatICU($localize`{viewers, plural, =0 {No viewers} =1 {1 viewer} other {{viewers} viewers}}`, { viewers: this.viewers() })
    }

    return formatICU($localize`{views, plural, =0 {No view} =1 {1 view} other {{views} views}}`, { views: this.views() })
  }
}
