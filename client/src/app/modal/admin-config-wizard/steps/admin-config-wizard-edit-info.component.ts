import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, numberAttribute, OnInit, output } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService, ThemeService } from '@app/core'
import { INSTANCE_NAME_VALIDATOR, INSTANCE_SHORT_DESCRIPTION_VALIDATOR } from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { ColorPickerModule } from 'primeng/colorpicker'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'

type Form = {
  platformName: FormControl<string>
  shortDescription: FormControl<string>
  primaryColor: FormControl<string>
}

export type FormInfo = FormDefaultTyped<Form>

@Component({
  selector: 'my-admin-config-wizard-edit-info',
  templateUrl: './admin-config-wizard-edit-info.component.html',
  styleUrls: [ './admin-config-wizard-edit-info.component.scss', '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [ CommonModule, FormsModule, ReactiveFormsModule, ColorPickerModule, CdkStepperModule, ButtonComponent ]
})
export class AdminConfigWizardEditInfoComponent implements OnInit {
  private server = inject(ServerService)
  private formReactiveService = inject(FormReactiveService)
  private themeService = inject(ThemeService)

  readonly currentStep = input.required({ transform: numberAttribute })
  readonly totalSteps = input.required({ transform: numberAttribute })
  readonly showBack = input.required({ transform: booleanAttribute })

  readonly back = output()
  readonly next = output<FormInfo>()
  readonly hide = output()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  ngOnInit () {
    this.buildForm()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      platformName: INSTANCE_NAME_VALIDATOR,
      shortDescription: INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
      primaryColor: null
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

  private getDefaultValues (): FormDefaultTyped<Form> {
    const config = this.server.getHTMLConfig()
    const primaryColorConfig = config.theme.customization.primaryColor

    const primaryColor = primaryColorConfig
      ? this.themeService.formatColorForForm(primaryColorConfig)
      : this.themeService.formatColorForForm(this.themeService.getCSSConfigValue('primaryColor'))

    return {
      platformName: config.instance.name,
      shortDescription: config.instance.shortDescription,
      primaryColor
    }
  }
}
