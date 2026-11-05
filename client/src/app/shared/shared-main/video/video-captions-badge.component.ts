import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID } from '@angular/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { hasOneOfLanguages } from '@peertube/peertube-core-utils'
import { Video } from './video.model'

@Component({
  selector: 'my-video-captions-badge',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ NgbTooltipModule ],
  template: `
    @if (hasCaptions()) {
      <span class="pt-badge badge-grey" [ngbTooltip]="tooltip" tabindex="0" [attr.aria-label]="tooltip" i18n>CC</span>
    }
  `
})
export class VideoCaptionsBadgeComponent {
  private localeId = inject(LOCALE_ID)

  readonly video = input.required<Pick<Video, 'captionLanguages'>>()

  // Video languages configured by the user, checked in addition to the interface language
  readonly userVideoLanguages = input<string[]>([])

  readonly hasCaptions = computed(() => {
    return hasOneOfLanguages(this.video().captionLanguages, [ this.localeId, ...(this.userVideoLanguages() || []) ])
  })

  readonly tooltip = $localize`Captions available in one of your languages`
}
