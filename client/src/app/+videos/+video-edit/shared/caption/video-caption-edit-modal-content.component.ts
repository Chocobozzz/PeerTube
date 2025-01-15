import { NgClass, NgForOf, NgIf } from '@angular/common'
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { VIDEO_CAPTION_FILE_CONTENT_VALIDATOR } from '@app/shared/form-validators/video-captions-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { TimestampInputComponent } from '@app/shared/shared-forms/timestamp-input.component'
import { Nl2BrPipe } from '@app/shared/shared-main/common/nl2br.pipe'
import { VideoCaptionEdit, VideoCaptionWithPathEdit } from '@app/shared/shared-main/video-caption/video-caption-edit.model'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { millisecondsToVttTime, sortBy, timeToInt } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, Video, VideoConstant } from '@peertube/peertube-models'
import { parse } from '@plussub/srt-vtt-parser'
import { PeerTubePlayer } from '../../../../../standalone/embed-player-api/player'
import { Notifier, ServerService } from '../../../../core'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../../../shared/shared-main/buttons/edit-button.component'

type Segment = {
  id: string

  startMs: number
  startFormatted: string

  endMs: number
  endFormatted: string

  text: string
}

@Component({
  styleUrls: [ './video-caption-edit-modal-content.component.scss' ],
  templateUrl: './video-caption-edit-modal-content.component.html',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    GlobalIconComponent,
    NgClass,
    NgIf,
    NgForOf,
    PeertubeCheckboxComponent,
    EmbedComponent,
    EditButtonComponent,
    ButtonComponent,
    TimestampInputComponent,
    DeleteButtonComponent,
    Nl2BrPipe
  ]
})
export class VideoCaptionEditModalContentComponent extends FormReactive implements OnInit, AfterViewInit {
  @Input() videoCaption: VideoCaptionWithPathEdit
  @Input() serverConfig: HTMLServerConfig
  @Input() publishedVideo: Video

  @Output() captionEdited = new EventEmitter<VideoCaptionEdit>()

  @ViewChild('textarea', { static: true }) textarea: ElementRef
  @ViewChild('embed') embed: EmbedComponent

  rawEdition = false
  segments: Segment[] = []

  segmentToUpdate: Segment
  segmentEditionError = ''
  private segmentToUpdateSave: Segment

  activeSegment: Segment

  videoCaptionLanguages: VideoConstant<string>[] = []

  timestampParser = this.webvttToMS.bind(this)
  timestampFormatter = millisecondsToVttTime

  private player: PeerTubePlayer

  constructor (
    protected openedModal: NgbActiveModal,
    protected formReactiveService: FormReactiveService,
    private videoCaptionService: VideoCaptionService,
    private serverService: ServerService,
    private notifier: Notifier,
    private cd: ChangeDetectorRef
  ) {
    super()
  }

  ngOnInit () {
    this.serverService.getVideoLanguages().subscribe(languages => {
      this.videoCaptionLanguages = languages
    })

    this.buildForm({ captionFileContent: VIDEO_CAPTION_FILE_CONTENT_VALIDATOR })

    this.loadCaptionContent()

    this.openedModal.update({ })
  }

  ngAfterViewInit () {
    if (this.embed) {
      this.player = new PeerTubePlayer(this.embed.getIframe())

      this.player.addEventListener('playbackStatusUpdate', ({ position }) => {
        this.activeSegment = undefined

        if (isNaN(position)) return

        for (let i = this.segments.length - 1; i >= 0; i--) {
          const current = this.segments[i]

          if (current.startMs / 1000 <= position && this.activeSegment !== current) {
            this.activeSegment = current
            this.cd.detectChanges()
            break
          }
        }
      })
    }
  }

  // ---------------------------------------------------------------------------

  loadCaptionContent () {
    this.rawEdition = false

    if (this.videoCaption.action === 'CREATE' || this.videoCaption.action === 'UPDATE') {
      const file = this.videoCaption.captionfile as File

      file.text().then(content => this.loadSegments(content))
      return
    }

    const { captionPath } = this.videoCaption
    if (!captionPath) return

    this.videoCaptionService.getCaptionContent({ captionPath })
      .subscribe(content => {
        this.loadSegments(content)
      })
  }

  onRawEditionSwitch () {
    if (this.rawEdition === true) {
      this.form.patchValue({ captionFileContent: this.formatSegments() })
      this.resetTextarea()
    } else {
      this.loadSegments(this.form.value['captionFileContent'])
      this.updateSegmentPositions()
    }
  }

  onSegmentClick (event: Event, segment: Segment) {
    event.preventDefault()

    if (!this.player) return

    this.player.play()
    this.player.seek(segment.startMs / 1000)
  }

  onEditionSaved (segment: Segment) {
    this.segmentEditionError = ''

    if (segment.startMs >= segment.endMs) {
      this.segmentEditionError = $localize`Start segment must be before end segment time`
      return
    }

    if (!segment.text) {
      this.segmentEditionError = $localize`Segment must have a text content`
      return
    }

    this.segmentToUpdate = undefined

    segment.startFormatted = millisecondsToVttTime(segment.startMs)
    segment.endFormatted = millisecondsToVttTime(segment.endMs)

    this.updateSegmentPositions()
    this.scrollToSegment(segment)
  }

  onEditionCanceled (segment: Segment) {
    if (!this.segmentToUpdateSave) {
      this.segments = this.segments.filter(s => s.id !== segment.id)
      return
    }

    segment.startMs = this.segmentToUpdateSave.startMs
    segment.endMs = this.segmentToUpdateSave.endMs
    segment.text = this.segmentToUpdateSave.text

    this.onEditionSaved(segment)
  }

  updateSegment (segment: Segment) {
    this.segmentEditionError = ''

    this.segmentToUpdateSave = { ...segment }
    this.segmentToUpdate = segment
  }

  async addSegmentToEdit () {
    const currentTime = this.player
      ? await this.player.getCurrentTime()
      : 0

    const startMs = currentTime * 1000
    const endMs = startMs + 1000

    const segment = {
      startMs,
      startFormatted: millisecondsToVttTime(startMs),
      endMs,
      endFormatted: millisecondsToVttTime(endMs),
      id: '0',
      text: ''
    }

    this.segments = [ segment, ...this.segments ]
    this.segmentToUpdate = segment

    document.querySelector<HTMLElement>('.segments').scrollTop = 0
  }

  deleteSegment (segment: Segment) {
    this.segments = this.segments.filter(s => s !== segment)
    this.updateSegmentPositions()
  }

  private updateSegmentPositions () {
    this.segments = sortBy(this.segments, 'startMs')

    for (let i = 1; i <= this.segments.length; i++) {
      this.segments[i - 1].id = `${i}`
    }
  }

  async videoTimeForSegmentStart (segment: Segment) {
    segment.startMs = await this.player.getCurrentTime() * 1000
    segment.startFormatted = millisecondsToVttTime(segment.startMs)
  }

  async videoTimeForSegmentEnd (segment: Segment) {
    segment.endMs = await this.player.getCurrentTime() * 1000
    segment.endFormatted = millisecondsToVttTime(segment.endMs)
  }

  private webvttToMS (webvttDuration: string) {
    const [ time, ms ] = webvttDuration.split('.')

    return timeToInt(time) * 1000 + parseInt(ms)
  }

  private loadSegments (content: string) {
    try {
      const entries = parse(content).entries

      this.segments = entries.map(({ id, from, to, text }) => {
        return {
          id,

          startMs: from,
          startFormatted: millisecondsToVttTime(from),

          endMs: to,
          endFormatted: millisecondsToVttTime(to),

          text
        }
      })
    } catch (err) {
      console.error(err)
      this.notifier.error($localize`Cannot parse subtitles`)
    }
  }

  private formatSegments () {
    let content = `WEBVTT\n`

    for (const segment of this.segments) {
      content += `\n${segment.id}\n`
      content += `${millisecondsToVttTime(segment.startMs)} --> ${millisecondsToVttTime(segment.endMs)}\n`
      content += `${segment.text}\n`
    }

    return content
  }

  private resetTextarea () {
    const el = this.textarea.nativeElement

    el.scrollTop = 0
    el.selectionStart = 0
    el.selectionEnd = 0
  }

  hide () {
    this.openedModal.dismiss()
  }

  updateCaption () {
    if (this.segmentToUpdate) {
      this.notifier.error($localize`A segment is being edited. Save or cancel the edition first.`)
      return
    }

    const languageId = this.videoCaption.language.id
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)

    if (this.rawEdition) {
      this.loadSegments(this.form.value['captionFileContent'])
    }

    this.captionEdited.emit({
      language: languageObject,
      captionfile: new File([ this.formatSegments() ], `${languageId}.vtt`, {
        type: 'text/vtt',
        lastModified: Date.now()
      }),
      action: 'UPDATE'
    })

    this.openedModal.close()
  }

  private scrollToSegment (segment: Segment) {
    setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`.segments > div:nth-child(${parseInt(segment.id) + 1})`)
      if (!element) return

      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}
