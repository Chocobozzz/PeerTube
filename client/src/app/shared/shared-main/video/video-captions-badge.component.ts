import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID, OnInit, signal } from '@angular/core'
import { ServerService } from '@app/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { filterWantedLanguages } from '@peertube/peertube-core-utils'
import { Video } from './video.model'

@Component({
  selector: 'my-video-captions-badge',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ NgbTooltipModule ],
  host: {
    // Don't apply margins set by the parent on an empty element
    '[hidden]': 'matchingLanguages().length === 0'
  },
  template: `
    @if (matchingLanguages().length !== 0) {
      <span class="pt-badge badge-grey" [ngbTooltip]="tooltip()" tabindex="0" [attr.aria-label]="tooltip()" i18n>CC</span>
    }
  `
})
export class VideoCaptionsBadgeComponent implements OnInit {
  private server = inject(ServerService)
  private localeId = inject(LOCALE_ID)

  readonly video = input.required<Pick<Video, 'captionLanguages'>>()

  // Video languages configured by the user, checked in addition to the interface language
  readonly userVideoLanguages = input<string[]>([])

  private readonly labels = signal(new Map<string, string>())

  readonly matchingLanguages = computed(() => {
    return filterWantedLanguages(this.video().captionLanguages, [ this.localeId, ...(this.userVideoLanguages() || []) ])
  })

  readonly tooltip = computed(() => {
    const labels = this.labels()
    const languages = this.matchingLanguages().map(l => labels.get(l) || l).join(', ')

    return $localize`Captions available in ${languages}:languages:`
  })

  ngOnInit () {
    this.server.getVideoTextLanguages()
      .subscribe(languages => this.labels.set(new Map(languages.map(l => [ l.id, l.label ]))))
  }
}
