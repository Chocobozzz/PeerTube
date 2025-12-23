import { NgClass } from '@angular/common'
import { ChangeDetectorRef, Component, ElementRef, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { VideoCaptionEdit, VideoCaptionWithPathEdit } from '@app/+videos-publish-manage/shared-manage/common/video-caption-edit.model'
import { VIDEO_CAPTION_FILE_CONTENT_VALIDATOR } from '@app/shared/form-validators/video-captions-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { TimestampInputComponent } from '@app/shared/shared-forms/timestamp-input.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { millisecondsToVttTime, sortBy, timeToInt } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, VideoConstant } from '@peertube/peertube-models'
import { parse } from '@plussub/srt-vtt-parser'
import { PeerTubePlayer } from '../../../../standalone/embed-player-api/player'
import { ConfirmService, Notifier, ServerService } from '../../../core'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../../shared/shared-main/buttons/edit-button.component'
import { VideoEdit } from '../common/video-edit.model'

type Segment = {
  id: string

  startMs: number
  startFormatted: string

  endMs: number
  endFormatted: string

  text: string
}

@Component({
  selector: 'my-video-caption-edit-modal',
  styleUrls: [ './video-caption-edit-modal.component.scss' ],
  templateUrl: './video-caption-edit-modal.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    GlobalIconComponent,
    NgClass,
    PeertubeCheckboxComponent,
    EmbedComponent,
    EditButtonComponent,
    ButtonComponent,
    TimestampInputComponent,
    DeleteButtonComponent
  ]
})
export class VideoCaptionEditModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private videoCaptionService = inject(VideoCaptionService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private cd = inject(ChangeDetectorRef)
  private modalService = inject(NgbModal)
  private confirmService = inject(ConfirmService)

  readonly textarea = viewChild<ElementRef>('textarea')
  readonly embed = viewChild<EmbedComponent>('embed')
  readonly modal = viewChild<ElementRef>('modal')

  private openedModal: NgbModalRef

  rawEdit = false
  segments: Segment[] = []

  segmentToUpdate: Segment
  segmentEditError = ''
  private segmentToUpdateSave: Segment

  activeSegment: Segment

  videoCaptionLanguages: VideoConstant<string>[] = []

  timestampParser = this.webvttToMS.bind(this)
  timestampFormatter = millisecondsToVttTime

  private player: PeerTubePlayer

  // Show options
  videoCaption: VideoCaptionWithPathEdit
  serverConfig: HTMLServerConfig
  videoEdit: VideoEdit
  captionEdited: (caption: VideoCaptionEdit) => any

  ngOnInit () {
    this.serverService.getVideoLanguages().subscribe(languages => {
      this.videoCaptionLanguages = languages
    })

    this.buildForm({ captionFileContent: VIDEO_CAPTION_FILE_CONTENT_VALIDATOR })
  }

  show (options: {
    videoCaption: VideoCaptionWithPathEdit
    serverConfig: HTMLServerConfig
    videoEdit: VideoEdit
    captionEdited: (caption: VideoCaptionEdit) => any
  }) {
    this.videoCaption = options.videoCaption
    this.serverConfig = options.serverConfig
    this.videoEdit = options.videoEdit
    this.captionEdited = options.captionEdited

    this.rawEdit = false
    this.segments = []
    this.segmentToUpdate = undefined

    this.openedModal = this.modalService.open(this.modal(), {
      centered: true,
      size: 'xl',

      beforeDismiss: () => {
        return this.confirmService.confirm(
          $localize`Are you sure you want to close this modal without saving your changes?`,
          $localize`Close modal window`
        )
      }
    })

    this.loadCaptionContent()

    setTimeout(() => this.initEmbed())
  }

  hide () {
    this.videoCaption = undefined
    this.serverConfig = undefined
    this.videoEdit = undefined
    this.captionEdited = undefined

    this.openedModal.close()
    this.form.reset()
  }

  initEmbed () {
    const embed = this.embed()
    if (embed) {
      this.player = new PeerTubePlayer(embed.getIframe())

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
    this.rawEdit = false

    if (this.videoCaption.action === 'CREATE' || this.videoCaption.action === 'UPDATE') {
      const file = this.videoCaption.captionfile as File

      file.text().then(content => this.loadSegments(content))
      return
    }

    const { fileUrl } = this.videoCaption
    if (!fileUrl) return

    this.videoCaptionService.getCaptionContent({ fileUrl })
      .subscribe(content => {
        this.loadSegments(content)
      })
  }

  onRawEditSwitch () {
    if (this.rawEdit === true) {
      this.segmentToUpdate = undefined
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

  onEditSaved (segment: Segment) {
    this.segmentEditError = ''

    if (segment.startMs >= segment.endMs) {
      this.segmentEditError = $localize`Start segment must be before end segment time`
      return
    }

    if (!segment.text) {
      this.segmentEditError = $localize`Segment must have a text content`
      return
    }

    this.segmentToUpdate = undefined

    segment.startFormatted = millisecondsToVttTime(segment.startMs)
    segment.endFormatted = millisecondsToVttTime(segment.endMs)

    this.updateSegmentPositions()
    this.scrollToSegment(segment)
  }

  onEditCanceled (segment: Segment) {
    if (!this.segmentToUpdateSave) {
      this.segments = this.segments.filter(s => s.id !== segment.id)
      return
    }

    segment.startMs = this.segmentToUpdateSave.startMs
    segment.endMs = this.segmentToUpdateSave.endMs
    segment.text = this.segmentToUpdateSave.text

    this.onEditSaved(segment)
  }

  updateSegment (segment: Segment) {
    this.segmentEditError = ''

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
    const el = this.textarea().nativeElement

    el.scrollTop = 0
    el.selectionStart = 0
    el.selectionEnd = 0
  }

  updateCaption () {
    if (this.segmentToUpdate) {
      this.notifier.error($localize`A segment is being edited. Save or cancel your edits first.`)
      return
    }

    const languageId = this.videoCaption.language.id
    const languageObject = this.videoCaptionLanguages.find(l => l.id === languageId)

    if (this.rawEdit) {
      this.loadSegments(this.form.value['captionFileContent'])
    }

    this.captionEdited({
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
