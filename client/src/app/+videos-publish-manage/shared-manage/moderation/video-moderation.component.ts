import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { ServerService } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'
import { VIDEO_NSFW_SUMMARY_VALIDATOR } from '@app/shared/form-validators/video-validators'
import { FormReactiveErrors, FormReactiveService, FormReactiveMessages } from '@app/shared/shared-forms/form-reactive.service'
import { HTMLServerConfig, VideoCommentPolicyType, VideoConstant } from '@peertube/peertube-models'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectRadioComponent } from '../../../shared/shared-forms/select/select-radio.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type Form = {
  nsfw: FormControl<boolean>

  nsfwFlagViolent: FormControl<boolean>
  nsfwFlagSex: FormControl<boolean>
  nsfwSummary: FormControl<string>

  commentPolicies: FormControl<VideoCommentPolicyType>
}

@Component({
  selector: 'my-video-moderation',
  styleUrls: [
    '../common/video-manage-page-common.scss'
  ],
  templateUrl: './video-moderation.component.html',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    PeerTubeTemplateDirective,
    PeertubeCheckboxComponent,
    GlobalIconComponent,
    SelectRadioComponent
  ]
})
export class VideoModerationComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  commentPolicies: VideoConstant<VideoCommentPolicyType>[] = []
  serverConfig: HTMLServerConfig

  private updatedSub: Subscription

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildForm()

    this.serverService.getCommentPolicies()
      .subscribe(res => this.commentPolicies = res)
  }

  ngOnDestroy () {
    this.updatedSub?.unsubscribe()
  }

  private buildForm () {
    const videoEdit = this.manageController.getStore().videoEdit

    const defaultValues = videoEdit.toCommonFormPatch()
    const obj: BuildFormArgument = {
      commentsPolicy: null,
      nsfw: null,
      nsfwFlagViolent: null,
      nsfwFlagSex: null,
      nsfwSummary: VIDEO_NSFW_SUMMARY_VALIDATOR
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => {
      this.manageController.setFormError($localize`Moderation`, 'moderation', this.formErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      videoEdit.loadFromCommonForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue(videoEdit.toCommonFormPatch())
    })

    this.updateNSFWControls(videoEdit.toCommonFormPatch().nsfw)
    this.trackNSFWChange()
  }

  private trackNSFWChange () {
    this.form.controls.nsfw
      .valueChanges
      .subscribe(newNSFW => this.updateNSFWControls(newNSFW))
  }

  private updateNSFWControls (nsfw: boolean) {
    const controls = [
      this.form.controls.nsfwFlagViolent,
      this.form.controls.nsfwFlagSex,
      this.form.controls.nsfwSummary
    ]

    if (!nsfw) {
      for (const control of controls) {
        control.disable()
      }

      return
    }

    for (const control of controls) {
      control.enable()
    }
  }
}
