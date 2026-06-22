import { Component, Injector, OnDestroy, OnInit, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core'
import { FormField, applyEach, form, validate } from '@angular/forms/signals'
import { ServerService } from '@app/core'
import { FormErrorComponent } from '@app/shared/shared-forms/form-error.component'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { TimestampInputComponent } from '@app/shared/shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import { sortBy } from '@peertube/peertube-core-utils'
import debug from 'debug'
import { Subscription } from 'rxjs'
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

  readonly studioModel = signal<StudioModel>({
    'cut': { start: 0, end: 0 },
    'add-intro': { file: null },
    'add-outro': { file: null },
    'add-watermark': { file: null },
    'remove-segments': []
  })

  readonly studioForm = form(this.studioModel, f => {
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
}
