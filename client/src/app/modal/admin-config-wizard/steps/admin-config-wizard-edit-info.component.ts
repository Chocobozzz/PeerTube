import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, numberAttribute, OnInit, output } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService, ThemeService } from '@app/core'
import { HEX_COLOR_CODE_VALIDATOR } from '@app/shared/form-validators/common-validators'
import { INSTANCE_NAME_VALIDATOR, INSTANCE_SHORT_DESCRIPTION_VALIDATOR } from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { PeertubeColorPickerComponent } from '@app/shared/shared-forms/peertube-color-picker.component'
import { PreviewUploadComponent } from '@app/shared/shared-forms/preview-upload.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { findAppropriateImage } from '@peertube/peertube-core-utils'
import { logger } from '@root-helpers/logger'

type Form = {
  platformName: FormControl<string>
  shortDescription: FormControl<string>
  avatar: FormControl<Blob>
  primaryColor: FormControl<string>
}

export type FormEditInfo = FormDefaultTyped<Form>

@Component({
  selector: 'my-admin-config-wizard-edit-info',
  templateUrl: './admin-config-wizard-edit-info.component.html',
  styleUrls: [ './admin-config-wizard-edit-info.component.scss', '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PeertubeColorPickerComponent,
    CdkStepperModule,
    ButtonComponent,
    PreviewUploadComponent
  ]
})
export class AdminConfigWizardEditInfoComponent implements OnInit {
  private server = inject(ServerService)
  private formReactiveService = inject(FormReactiveService)
  private themeService = inject(ThemeService)

  readonly currentStep = input.required({ transform: numberAttribute })
  readonly totalSteps = input.required({ transform: numberAttribute })
  readonly showBack = input.required({ transform: booleanAttribute })

  readonly back = output()
  readonly next = output<FormEditInfo>()
  readonly hide = output()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  ngOnInit () {
    this.buildForm()

    const avatar = findAppropriateImage(this.server.getHTMLConfig().instance.avatars, 128)
    if (avatar) {
      fetch(avatar.fileUrl)
        .then(response => response.blob())
        .then(blob => this.form.patchValue({ avatar: blob }))
        .catch(() => {
          logger.error('Could not fetch instance avatar')
        })
    }
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      platformName: INSTANCE_NAME_VALIDATOR,
      shortDescription: INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
      avatar: null,
      primaryColor: HEX_COLOR_CODE_VALIDATOR
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, this.getDefaultValues())

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  private getDefaultValues (): FormEditInfo {
    const config = this.server.getHTMLConfig()
    const primaryColorConfig = config.theme.customization.primaryColor

    const primaryColor = primaryColorConfig
      ? this.themeService.formatColorForForm(primaryColorConfig)
      : this.themeService.formatColorForForm(this.themeService.getCSSConfigValue('primaryColor'))

    return {
      platformName: config.instance.name,
      shortDescription: config.instance.shortDescription,
      avatar: undefined as Blob,
      primaryColor
    }
  }
}
