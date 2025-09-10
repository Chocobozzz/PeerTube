import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
import { Component, inject, input, numberAttribute, OnInit, output } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService, ThemeService } from '@app/core'
import { INSTANCE_NAME_VALIDATOR } from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { ColorPickerModule } from 'primeng/colorpicker'
import { debounceTime } from 'rxjs'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { CommunityBasedConfigComponent } from './usage-type/community-based-config.component'
import { InstitutionalConfigComponent } from './usage-type/institutional-config.component'
import { PrivateInstanceConfigComponent } from './usage-type/private-instance-config.component'
import { UsageType } from './usage-type/usage-type.model'
import { CustomIconComponent } from '../../../shared/shared-icons/custom-icon.component'

type Form = {
  platformName: FormControl<string>
  primaryColor: FormControl<string>
}

type PlatformType = 'community' | 'institution' | 'private'

@Component({
  selector: 'my-admin-config-wizard-form',
  templateUrl: './admin-config-wizard-form.component.html',
  styleUrls: [ './admin-config-wizard-form.component.scss', '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    ButtonComponent,
    GlobalIconComponent,
    CommunityBasedConfigComponent,
    PrivateInstanceConfigComponent,
    InstitutionalConfigComponent,
    CustomIconComponent
  ]
})
export class AdminConfigWizardFormComponent implements OnInit {
  private server = inject(ServerService)
  private formReactiveService = inject(FormReactiveService)
  private themeService = inject(ThemeService)

  readonly currentStep = input.required({ transform: numberAttribute })
  readonly totalSteps = input.required({ transform: numberAttribute })

  readonly back = output()
  readonly next = output<UsageType>()
  readonly hide = output()

  iconKey = require('../../../../assets/images/feather/key.svg')
  iconInstitution = require('../../../../assets/images/feather/institution.svg')

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  platformType: PlatformType
  usageType: { [id in PlatformType]: UsageType } = {
    community: UsageType.initForCommunity(),
    institution: UsageType.initForInstitution(),
    private: UsageType.initForPrivateInstance()
  }

  ngOnInit () {
    this.buildForm()

    this.subscribeToColorChanges()
  }

  private subscribeToColorChanges () {
    let currentAnimationFrame: number

    this.form.get('primaryColor').valueChanges.pipe(debounceTime(250)).subscribe(value => {
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame)
        currentAnimationFrame = null
      }

      currentAnimationFrame = requestAnimationFrame(() => {
        const config = this.server.getHTMLConfig()

        this.themeService.updateColorPalette({
          ...config.theme,

          customization: {
            ...config.theme.customization,

            primaryColor: this.themeService.formatColorForForm(value)
          }
        })
      })
    })
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      platformName: INSTANCE_NAME_VALIDATOR,
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
      primaryColor
    }
  }
}
