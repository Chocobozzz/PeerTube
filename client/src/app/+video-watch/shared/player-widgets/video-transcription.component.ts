import { NgClass } from '@angular/common'
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  Renderer2,
  SimpleChanges,
  viewChild
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { durationToString, isInViewport } from '@app/helpers'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { Nl2BrPipe } from '@app/shared/shared-main/common/nl2br.pipe'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap'
import { Video, VideoCaption } from '@peertube/peertube-models'
import { parse } from '@plussub/srt-vtt-parser'
import { SelectOptionsItem } from '@pt-types'
import debug from 'debug'
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs'

const debugLogger = debug('peertube:watch:VideoTranscriptionComponent')

type Segment = {
  start: number
  startFormatted: string

  end: number

  text: string
}

@Component({
  selector: 'my-video-transcription',
  templateUrl: './video-transcription.component.html',
  styleUrls: [ './player-widget.component.scss', './video-transcription.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgClass,
    GlobalIconComponent,
    NgbCollapse,
    FormsModule,
    SelectOptionsComponent,
    Nl2BrPipe,
    ButtonComponent
  ]
})
export class VideoTranscriptionComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private notifier = inject(Notifier)
  private captionService = inject(VideoCaptionService)
  private zone = inject(NgZone)
  private renderer = inject(Renderer2)

  readonly settingsPanel = viewChild<ElementRef>('settingsPanel')
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput')
  readonly segmentsContainer = viewChild<ElementRef<HTMLElement>>('segmentsContainer')

  readonly video = input<Video>(undefined)
  readonly captions = input<VideoCaption[]>(undefined)
  // Output the duration clicked
  readonly currentTime = input<number>(undefined)

  // Output the duration clicked
  readonly segmentClicked = output<number>()
  readonly closeTranscription = output()

  currentCaption: VideoCaption
  segments: Segment[] = []
  activeSegment: Segment

  search = ''

  currentLanguage: string
  languagesOptions: SelectOptionsItem[] = []

  isSettingsPanelCollapsed: boolean
  // true when collapsed has been shown (after the transition)
  settingsPanelShown: boolean

  // false when the user manually scrolled the segments, disabling the auto scroll to the played segment
  autoScrollEnabled = true

  private segmentsStore: Segment[] = []
  private searchSubject = new Subject<string>()

  // Scroll position we set automatically when syncing with the video
  // undefined when the segments have just been replaced and the container position is not settled yet
  private expectedScrollTop = 0
  private unlistenScroll: () => void

  @HostListener('document:click', [ '$event' ])
  clickout (event: Event) {
    if (!this.settingsPanelShown) return

    if (!this.settingsPanel()?.nativeElement.contains(event.target)) {
      this.isSettingsPanelCollapsed = true
    }
  }

  ngOnInit () {
    this.searchSubject.asObservable()
      .pipe(
        debounceTime(100),
        distinctUntilChanged()
      )
      .subscribe(search => this.filterSegments(search))
  }

  ngAfterViewInit () {
    const container = this.segmentsContainer().nativeElement

    // Scroll events are emitted very often: don't run change detection for each of them
    this.zone.runOutsideAngular(() => {
      this.unlistenScroll = this.renderer.listen(container, 'scroll', () => this.onSegmentsScroll(container))
    })
  }

  ngOnDestroy () {
    if (this.unlistenScroll) this.unlistenScroll()
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['video'] || changes['captions']) {
      this.load()
      return
    }

    if (changes['currentTime']) {
      this.findActiveSegment()
    }
  }

  getSegmentClasses (segment: Segment) {
    return { active: this.activeSegment === segment, ['segment-' + segment.start]: true }
  }

  updateCurrentCaption () {
    this.currentCaption = this.captions().find(c => c.language.id === this.currentLanguage)

    this.parseCurrentCaption()
  }

  private load () {
    this.search = ''

    this.segmentsStore = []
    this.setSegments([])

    this.activeSegment = undefined
    this.currentCaption = undefined

    this.autoScrollEnabled = true

    this.isSettingsPanelCollapsed = true
    this.settingsPanelShown = false

    this.languagesOptions = []

    const captions = this.captions()
    const video = this.video()
    if (!video || !captions || captions.length === 0) return

    this.currentLanguage = captions.some(c => c.language.id === this.video().language.id)
      ? video.language.id
      : captions[0].language.id

    this.languagesOptions = captions.map(c => ({
      id: c.language.id,
      label: c.automaticallyGenerated
        ? $localize`${c.language.label} (automatically generated)`
        : c.language.label
    }))

    this.updateCurrentCaption()
  }

  private parseCurrentCaption () {
    this.captionService.getCaptionContent({ fileUrl: this.currentCaption.fileUrl })
      .subscribe({
        next: content => {
          try {
            const entries = parse(content).entries

            this.segmentsStore = entries.map(({ from, to, text }) => {
              const start = Math.round(from / 1000)
              const end = Math.round(to / 1000)

              return {
                start,
                startFormatted: durationToString(start),
                end,
                text
              }
            })

            this.setSegments(this.segmentsStore)
          } catch (err: unknown) {
            this.notifier.error($localize`Cannot load transcript: ${(err as Error).message}`)
          }
        },

        error: err => this.notifier.handleError(err)
      })
  }

  // ---------------------------------------------------------------------------

  onSearchChange (event: Event) {
    const target = event.target as HTMLInputElement

    this.searchSubject.next(target.value)
  }

  onSegmentClick (event: Event, segment: Segment) {
    event.preventDefault()

    this.segmentClicked.emit(segment.start)
  }

  resyncWithVideo () {
    this.autoScrollEnabled = true

    // The active segment may be filtered out by the search: display the whole transcript so we can scroll to it
    this.clearSearch()

    this.scrollToActiveSegment({ force: true })
  }

  // ---------------------------------------------------------------------------

  // Run outside of the Angular zone
  private onSegmentsScroll (container: HTMLElement) {
    if (!this.autoScrollEnabled) return

    // The segments have just been replaced: the browser may still adjust the scroll position
    if (this.expectedScrollTop === undefined) return

    // We scrolled the container ourselves
    if (Math.abs(container.scrollTop - this.expectedScrollTop) < 1) return

    this.zone.run(() => {
      this.autoScrollEnabled = false
    })
  }

  private clearSearch () {
    const input = this.searchInput()?.nativeElement
    if (input) input.value = ''

    // Update the segments right away but also feed the subject, so the same search can be typed again
    this.searchSubject.next('')
    this.filterSegments('')
  }

  private filterSegments (search: string) {
    this.search = search

    const searchLowercase = search.toLocaleLowerCase()

    this.setSegments(this.segmentsStore.filter(s => {
      return s.text.toLocaleLowerCase().includes(searchLowercase)
    }))
  }

  private setSegments (segments: Segment[]) {
    this.segments = segments

    // Restore expected scroll when the container will be rendered
    this.expectedScrollTop = undefined

    setTimeout(() => {
      const container = this.segmentsContainer()?.nativeElement

      this.expectedScrollTop = container
        ? container.scrollTop
        : 0
    })
  }

  private findActiveSegment () {
    const lastActiveSegment = this.activeSegment
    this.activeSegment = undefined

    const currentTime = this.currentTime()
    if (isNaN(currentTime)) return

    for (let i = this.segmentsStore.length - 1; i >= 0; i--) {
      const current = this.segmentsStore[i]

      if (current.start <= currentTime) {
        this.activeSegment = current
        break
      }
    }

    if (lastActiveSegment !== this.activeSegment && this.autoScrollEnabled) {
      this.scrollToActiveSegment()
    }
  }

  private scrollToActiveSegment (options: { force?: boolean } = {}) {
    const { force = false } = options

    setTimeout(() => {
      const container = this.segmentsContainer()?.nativeElement
      if (!container) return

      if (!this.activeSegment) {
        if (force) this.setScrollTop(container, 0)

        return
      }

      const element = container.querySelector<HTMLElement>('.segment-' + this.activeSegment.start)
      if (!element) return // Can happen with a search

      if (!force && isInViewport(element, container)) return

      this.setScrollTop(container, container.scrollTop + element.getBoundingClientRect().top - container.getBoundingClientRect().top)

      debugLogger(`Set transcription segment ${this.activeSegment.start} in viewport`)
    })
  }

  private setScrollTop (container: HTMLElement, scrollTop: number) {
    container.scrollTop = scrollTop

    // The browser may have clamped the value, so use the effective position as reference
    this.expectedScrollTop = container.scrollTop
  }
}
