
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { FormReactiveErrors, FormReactiveService, FormReactiveMessages } from '@app/shared/shared-forms/form-reactive.service'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { TimestampInputComponent } from '@app/shared/shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { getStudioUnavailability } from '../common/unavailable-features'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type Form = {
  'cut': FormGroup<{ start: FormControl<number>, end: FormControl<number> }>
  'add-intro': FormGroup<{ file: FormControl<File> }>
  'add-outro': FormGroup<{ file: FormControl<File> }>
  'add-watermark': FormGroup<{ file: FormControl<File> }>
}

@Component({
  selector: 'my-video-studio',
  templateUrl: './video-studio.component.html',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-studio.component.scss'
  ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TimestampInputComponent,
    ReactiveFileComponent,
    EmbedComponent,
    GlobalIconComponent,
    AlertComponent
]
})
export class VideoStudioEditComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  isRunningEdit = false

  videoEdit: VideoEdit

  studioEnabled: boolean
  instanceName: string

  private updatedSub: Subscription

  ngOnInit () {
    this.videoEdit = this.manageController.getStore().videoEdit

    const config = this.serverService.getHTMLConfig()
    this.studioEnabled = config.videoStudio.enabled === true
    this.instanceName = config.instance.name

    const { form, formErrors, validationMessages } = this.formReactiveService.buildForm<Form>({
      'cut': {
        start: null,
        end: null
      },
      'add-intro': {
        file: null
      },
      'add-outro': {
        file: null
      },
      'add-watermark': {
        file: null
      }
    }, this.videoEdit.toStudioFormPatch())

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => {
      this.manageController.setFormError($localize`Studio`, 'studio', this.formErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      this.videoEdit.loadFromStudioForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue(this.videoEdit.toStudioFormPatch())
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

  getIntroOutroTooltip () {
    return $localize`(extensions: ${this.videoExtensions.join(', ')})`
  }

  getWatermarkTooltip () {
    return $localize`(extensions: ${this.imageExtensions.join(', ')})`
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
}
