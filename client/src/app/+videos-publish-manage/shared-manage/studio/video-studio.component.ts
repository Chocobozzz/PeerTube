import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core'
import { FormField, applyEach, form, validate } from '@angular/forms/signals'
import { Notifier, ServerService } from '@app/core'
import { FormErrorComponent } from '@app/shared/shared-forms/form-error.component'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { TimestampInputComponent } from '@app/shared/shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import { sortBy } from '@peertube/peertube-core-utils'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { PeerTubePlayer } from '../../../../standalone/embed-player-api/player'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { getStudioUnavailability } from '../common/unavailable-features'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type Segment = { start: number, end: number }

type StudioModel = {
  cut: Segment
  'add-intro': { file: File | null }
  'add-outro': { file: File | null }
  'add-watermark': { file: File | null }
  'remove-segments': Segment[]
}

@Component({
  selector: 'my-video-studio',
  templateUrl: './video-studio.component.html',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-studio.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TimestampInputComponent,
    ReactiveFileComponent,
    EmbedComponent,
    GlobalIconComponent,
    AlertComponent,
    ButtonComponent,
    FormField,
    FormErrorComponent
  ]
})
export class VideoStudioEditComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector)
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)
  private notifier = inject(Notifier)

  readonly embed = viewChild(EmbedComponent)
  readonly playerReady = signal(false)
  readonly capturingTime = signal(false)

  private player: PeerTubePlayer
  private playerIframe: HTMLIFrameElement

  readonly studioModel = signal<StudioModel>({
    'cut': { start: 0, end: 0 },
    'add-intro': { file: null },
    'add-outro': { file: null },
    'add-watermark': { file: null },
    'remove-segments': []
  })

  readonly studioForm = form(this.studioModel, f => {
    validate(f.cut, ({ value }) => {
      const { start, end } = value()

      return start >= end
        ? { kind: 'startAfterEnd', message: $localize`Start time must be before end time.` }
        : null
    })

    validate(f['remove-segments'], ({ value }) => {
      const sorted = sortBy(value().filter(s => s.start < s.end), 'start')

      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end > sorted[i + 1].start) {
          return { kind: 'segmentsOverlap', message: $localize`Segments must not overlap each other.` }
        }
      }
      return null
    })

    applyEach(
      f['remove-segments'],
      seg => {
        validate(seg, ({ value }) => {
          const { start, end } = value()

          return start >= end
            ? { kind: 'startAfterEnd', message: $localize`Start time must be before end time.` }
            : null
        })
      }
    )
  })

  isRunningEdit = false

  videoEdit!: VideoEdit

  studioEnabled = false
  instanceName = ''

  private updatedSub!: Subscription

  constructor () {
    afterRenderEffect(() => {
      const embed = this.embed()
      embed?.video()
      embed?.version()

      const iframe = embed?.getIframe()
      if (iframe === this.playerIframe) return

      this.player = undefined
      this.playerIframe = iframe
      this.playerReady.set(false)
      this.capturingTime.set(false)

      if (!iframe) return

      try {
        const player = new PeerTubePlayer(iframe)
        this.player = player

        player.ready.then(() => {
          if (this.player === player) this.playerReady.set(true)
        }).catch(() => {
          if (this.player === player) this.notifyPlayerError()
        })
      } catch {
        this.notifyPlayerError()
      }
    })
  }

  ngOnInit () {
    this.videoEdit = this.manageController.getStore().videoEdit

    const config = this.serverService.getHTMLConfig()
    this.studioEnabled = config.videoStudio.enabled === true
    this.instanceName = config.instance.name

    this.syncModelFromPatch()

    effect(() => {
      const values = this.studioModel()
      const errors = this.studioForm().errorSummary()
      const formErrors = Object.fromEntries(errors.map(e => [ e.kind, e.message ?? e.kind ]))

      setTimeout(() => {
        debugLogger('Updating form values', values)
        this.videoEdit.loadFromStudioForm(values)

        this.manageController.setFormError($localize`Studio`, 'studio', formErrors)
      })
    }, { injector: this.injector })

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.syncModelFromPatch()
    })
  }

  ngOnDestroy (): void {
    this.updatedSub?.unsubscribe()
    this.player = undefined
  }

  get videoExtensions () {
    return this.serverService.getHTMLConfig().video.file.extensions
  }

  get imageExtensions () {
    return this.serverService.getHTMLConfig().video.image.extensions
  }

  get removeSegments () {
    return this.studioModel()['remove-segments']
  }

  getIntroOutroTooltip () {
    return $localize`(extensions: ${this.videoExtensions.join(', ')})`
  }

  getWatermarkTooltip () {
    return $localize`(extensions: ${this.imageExtensions.join(', ')})`
  }

  addSegmentRemoval (start = 0, end = this.videoEdit?.getVideoAttributes().duration ?? 0) {
    this.studioModel.update(m => ({
      ...m,

      'remove-segments': [ ...m['remove-segments'], { start, end } ]
    }))
  }

  removeSegmentRemoval (index: number) {
    this.studioModel.update(m => ({
      ...m,

      'remove-segments': m['remove-segments'].filter((_, i) => i !== index)
    }))
  }

  async setTimeFromPlayer (boundary: 'start' | 'end', segmentIndex?: number) {
    const player = this.player
    if (!player || !this.playerReady() || this.capturingTime()) return

    const segment = segmentIndex === undefined
      ? this.studioModel().cut
      : this.studioModel()['remove-segments'][segmentIndex]

    if (!segment) return

    this.capturingTime.set(true)

    try {
      const currentTime = await player.getCurrentTime()
      if (this.player !== player) return
      if (!Number.isFinite(currentTime)) throw new Error('Invalid player time')

      const duration = this.videoEdit.getVideoAttributes().duration
      const timestamp = Math.max(0, Math.min(duration, Math.round(currentTime)))
      const currentSegment = segmentIndex === undefined
        ? this.studioModel().cut
        : this.studioModel()['remove-segments'][segmentIndex]

      if (currentSegment !== segment) return

      this.studioModel.update(model => {
        if (segmentIndex === undefined) {
          return { ...model, cut: { ...segment, [boundary]: timestamp } }
        }

        return {
          ...model,

          'remove-segments': model['remove-segments'].map((value, index) =>
            index === segmentIndex ? { ...value, [boundary]: timestamp } : value
          )
        }
      })

      const field = segmentIndex === undefined
        ? this.studioForm.cut[boundary]
        : this.studioForm['remove-segments'][segmentIndex][boundary]

      field().markAsTouched()
    } catch {
      if (this.player === player) this.notifyPlayerError()
    } finally {
      if (this.player === player) this.capturingTime.set(false)
    }
  }

  noEdit () {
    return this.videoEdit.getStudioTasks().length === 0
  }

  getUnavailability () {
    return getStudioUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      studioEnabled: this.studioEnabled
    })
  }

  private syncModelFromPatch () {
    const patch = this.videoEdit.toStudioFormPatch()
    const duration = this.videoEdit.getVideoAttributes().duration

    this.studioModel.set({
      'cut': {
        start: patch.cut?.start ?? 0,
        end: patch.cut?.end ?? duration
      },
      'add-intro': { file: patch['add-intro']?.file ?? null },
      'add-outro': { file: patch['add-outro']?.file ?? null },
      'add-watermark': { file: patch['add-watermark']?.file ?? null },
      'remove-segments': (patch['remove-segments'] ?? []).map(s => ({ start: s.start ?? 0, end: s.end ?? 0 }))
    })
  }

  private notifyPlayerError () {
    this.notifier.error($localize`Could not read the current player time.`)
  }
}
