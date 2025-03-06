import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveErrors, FormReactiveService, FormReactiveValidationMessages } from '@app/shared/shared-forms/form-reactive.service'
import { canVideoFileBeEdited } from '@peertube/peertube-core-utils'
import { VideoState } from '@peertube/peertube-models'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { ReactiveFileComponent } from '../../../shared/shared-forms/reactive-file.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { VideoEdit } from '../common/video-edit.model'
import { VideoUploadService } from '../common/video-upload.service'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type Form = {
  replaceFile: FormControl<File>
}

@Component({
  selector: 'my-video-replace-file',
  styleUrls: [
    '../common/video-manage-page-common.scss'
  ],
  templateUrl: './video-replace-file.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ReactiveFileComponent,
    AlertComponent,
    GlobalIconComponent
  ]
})
export class VideoReplaceFileComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private videoUploadService = inject(VideoUploadService)
  private manageController = inject(VideoManageController)
  private server = inject(ServerService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveValidationMessages = {}

  videoEdit: VideoEdit

  replaceFileEnabled: boolean
  instanceName: string

  private updatedSub: Subscription

  ngOnInit () {
    this.videoEdit = this.manageController.getStore().videoEdit

    const config = this.server.getHTMLConfig()
    this.replaceFileEnabled = config.videoFile.update.enabled === true
    this.instanceName = config.instance.name

    const defaultValues = this.videoEdit.toReplaceFileFormPatch()
    const obj: BuildFormArgument = { replaceFile: null }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => {
      this.manageController.setFormError($localize`Replace file`, 'replace-file', this.formErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      this.videoEdit.loadFromReplaceFileForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue(this.videoEdit.toReplaceFileFormPatch())
    })
  }

  ngOnDestroy (): void {
    this.updatedSub?.unsubscribe()
  }

  getVideoExtensions () {
    return this.videoUploadService.getVideoExtensions()
  }

  canFileBeReplaced () {
    return canVideoFileBeEdited(this.videoEdit.getVideoAttributes().state)
  }

  isLive () {
    return this.videoEdit.getVideoAttributes().isLive
  }

  isTranscoding () {
    return this.videoEdit.getVideoAttributes().state === VideoState.TO_TRANSCODE
  }

  isEditing () {
    return this.videoEdit.getVideoAttributes().state === VideoState.TO_EDIT
  }

  isImporting () {
    return this.videoEdit.getVideoAttributes().state === VideoState.TO_IMPORT
  }
}
