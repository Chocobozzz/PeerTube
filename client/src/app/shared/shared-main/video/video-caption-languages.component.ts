import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core'
import { ServerService } from '@app/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { Video } from './video.model'

@Component({
  selector: 'my-video-caption-languages',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ NgbTooltipModule ],
  template: `
    @if (languages().displayed.length !== 0) {
      <div class="pt-badges-container">
        @for (label of languages().displayed; track label) {
          <span class="pt-badge badge-grey pt-badge-keep-case">{{ label }}</span>
        }

        @if (languages().hidden.length !== 0) {
          <span
            class="pt-badge badge-grey" tabindex="0"
            [ngbTooltip]="languages().hidden.join(', ')" [attr.aria-label]="languages().hidden.join(', ')"
          >+{{ languages().hidden.length }}</span>
        }
      </div>
    }
  `
})
export class VideoCaptionLanguagesComponent implements OnInit {
  private server = inject(ServerService)

  readonly video = input.required<Pick<Video, 'captionLanguages'>>()
  readonly max = input(5)

  private readonly labels = signal(new Map<string, string>())

  readonly languages = computed(() => {
    const labels = this.labels()
    const all = (this.video().captionLanguages || []).map(l => labels.get(l) || l)

    return {
      displayed: all.slice(0, this.max()),
      hidden: all.slice(this.max())
    }
  })

  ngOnInit () {
    this.server.getVideoTextLanguages()
      .subscribe(languages => this.labels.set(new Map(languages.map(l => [ l.id, l.label ]))))
  }
}
