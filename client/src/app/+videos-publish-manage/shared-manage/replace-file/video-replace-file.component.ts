
import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveErrors, FormReactiveService, FormReactiveMessages } from '@app/shared/shared-forms/form-reactive.service'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { ReactiveFileComponent } from '../../../shared/shared-forms/reactive-file.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { AlertComponent } from '../../../shared/shared-main/common/alert.component'
import { getReplaceFileUnavailability } from '../common/unavailable-features'
import { VideoEdit } from '../common/video-edit.model'
import { VideoUploadService } from '../common/video-upload.service'
import { VideoManageController } from '../video-manage-controller.service'
import { DragDropDirective } from '@app/+videos-publish-manage/+video-publish/shared/drag-drop.directive'

const debugLogger = debug('peertube:video-manage')

type Form = {
  replaceFile: FormControl<File>
}

@Component({
  selector: 'my-video-replace-file',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-replace-file.component.scss'
  ],
  templateUrl: './video-replace-file.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ReactiveFileComponent,
    AlertComponent,
    GlobalIconComponent,
    DragDropDirective
]
})
export class VideoReplaceFileComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private videoUploadService = inject(VideoUploadService)
  private manageController = inject(VideoManageController)
  private server = inject(ServerService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

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

  @ViewChild('reactiveFileInput')
  reactiveFile: ReactiveFileComponent
  onFileDropped (files: FileList) {
    this.reactiveFile.fileChange({ target: { files } })
    // this.onFileChanged(files[0])
  }

  onFileChanged (file: File | Blob) {
    if (!file) return

    if (!(file instanceof File)) {
      // console.error('Received unexpected non-File:', file)
      return
    }

    // Put the file in the form control to activate the save button
    this.form.controls.replaceFile.setValue(file)
    this.form.controls.replaceFile.markAsDirty()
    this.form.markAsDirty()
    this.form.updateValueAndValidity()
  }

  getVideoExtensions () {
    return this.videoUploadService.getVideoExtensions()
  }

  getUnavailability () {
    return getReplaceFileUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      replaceFileEnabled: this.replaceFileEnabled
    })
  }
}
