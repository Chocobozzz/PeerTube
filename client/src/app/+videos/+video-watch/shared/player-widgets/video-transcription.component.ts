import { NgClass, NgFor, NgIf } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { durationToString, isInViewport } from '@app/helpers'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { Video, VideoCaption } from '@peertube/peertube-models'
import { parse } from '@plussub/srt-vtt-parser'
import debug from 'debug'
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { Nl2BrPipe } from '../../../../shared/shared-main/common/nl2br.pipe'

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
  imports: [
    NgIf,
    NgClass,
    NgbTooltip,
    GlobalIconComponent,
    NgFor,
    NgbCollapse,
    FormsModule,
    SelectOptionsComponent,
    Nl2BrPipe
  ]
})
export class VideoTranscriptionComponent implements OnInit, OnChanges {
  @ViewChild('settingsPanel') settingsPanel: ElementRef

  @Input() video: Video
  @Input() captions: VideoCaption[]
  @Input() currentTime: number

  // Output the duration clicked
  @Output() segmentClicked = new EventEmitter<number>()
  @Output() closeTranscription = new EventEmitter<void>()

  currentCaption: VideoCaption
  segments: Segment[] = []
  activeSegment: Segment

  search = ''

  currentLanguage: string
  languagesOptions: SelectOptionsItem[] = []

  isSettingsPanelCollapsed: boolean
  // true when collapsed has been shown (after the transition)
  settingsPanelShown: boolean

  private segmentsStore: Segment[] = []
  private searchSubject = new Subject<string>()

  constructor (
    private notifier: Notifier,
    private captionService: VideoCaptionService
  ) {
  }

  @HostListener('document:click', [ '$event' ])
  clickout (event: Event) {
    if (!this.settingsPanelShown) return

    if (!this.settingsPanel?.nativeElement.contains(event.target)) {
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
    this.currentCaption = this.captions.find(c => c.language.id === this.currentLanguage)

    this.parseCurrentCaption()
  }

  private load () {
    this.search = ''

    this.segmentsStore = []
    this.segments = []

    this.activeSegment = undefined
    this.currentCaption = undefined

    this.isSettingsPanelCollapsed = true
    this.settingsPanelShown = false

    this.languagesOptions = []

    if (!this.video || !this.captions || this.captions.length === 0) return

    this.currentLanguage = this.captions.some(c => c.language.id === this.video.language.id)
      ? this.video.language.id
      : this.captions[0].language.id

    this.languagesOptions = this.captions.map(c => ({
      id: c.language.id,
      label: c.automaticallyGenerated
        ? $localize`${c.language.label} (automatically generated)`
        : c.language.label
    }))

    this.updateCurrentCaption()
  }

  private parseCurrentCaption () {
    this.captionService.getCaptionContent({ captionPath: this.currentCaption.captionPath })
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

            this.segments = this.segmentsStore
          } catch (err) {
            this.notifier.error($localize`Cannot load transcript: ${err.message}`)
          }
        },

        error: err => this.notifier.error(err.message)
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

  // ---------------------------------------------------------------------------

  private filterSegments (search: string) {
    this.search = search

    const searchLowercase = search.toLocaleLowerCase()

    this.segments = this.segmentsStore.filter(s => {
      return s.text.toLocaleLowerCase().includes(searchLowercase)
    })
  }

  private findActiveSegment () {
    const lastActiveSegment = this.activeSegment
    this.activeSegment = undefined

    if (isNaN(this.currentTime)) return

    for (let i = this.segmentsStore.length - 1; i >= 0; i--) {
      const current = this.segmentsStore[i]

      if (current.start <= this.currentTime) {
        this.activeSegment = current
        break
      }
    }

    if (lastActiveSegment !== this.activeSegment) {
      setTimeout(() => {
        const element = document.querySelector<HTMLElement>('.segment-' + this.activeSegment.start)
        if (!element) return // Can happen with a search

        const container = document.querySelector<HTMLElement>('.widget-root')

        if (isInViewport(element, container)) return

        container.scrollTop = element.offsetTop

        debugLogger(`Set transcription segment ${this.activeSegment.start} in viewport`)
      })
    }
  }
}
