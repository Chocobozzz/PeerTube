import { CdkStepperModule } from '@angular/cdk/stepper'

import { Component, inject, model, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { ColorPickerModule } from 'primeng/colorpicker'
import { SelectOptionsItem } from 'src/types'
import { AuthType, EnabledDisabled, UsageType } from './usage-type.model'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'

type Form = {
  keepOriginalVideo: FormControl<EnabledDisabled>
  p2p: FormControl<EnabledDisabled>
  transcription: FormControl<EnabledDisabled>
  authType: FormControl<AuthType>
}

@Component({
  selector: 'my-institutional-config',
  templateUrl: './institutional-config.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    SelectOptionsComponent,
    GlobalIconComponent
]
})
export class InstitutionalConfigComponent implements OnInit {
  private formReactiveService = inject(FormReactiveService)

  usageType = model.required<UsageType>()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  p2pOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: $localize`Enabled`,
      description: $localize`Enable P2P streaming by default for anonymous and new users`
    },
    {
      id: 'disabled',
      label: $localize`Disabled`,
      description: $localize`Disable P2P streaming`
    }
  ]

  transcriptionOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: $localize`Enabled`,
      description: $localize`Enable automatic transcription of videos to automatically generate subtitles`
    },
    {
      id: 'disabled',
      label: $localize`Disabled`,
      description: $localize`Disable automatic transcription of videos`
    }
  ]

  keepOriginalVideoOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: $localize`Yes`,
      description: $localize`Keep the original video file on the server`
    },
    {
      id: 'disabled',
      label: $localize`No`,
      description: $localize`Delete the original video file after processing`
    }
  ]

  authenticationOptions: SelectOptionsItem<AuthType>[] = [
    {
      id: 'local',
      label: $localize`Disabled`,
      description: $localize`Your platform will manage user registration and login internally`
    },
    {
      id: 'ldap',
      label: $localize`LDAP`,
      description: $localize`Use LDAP for user authentication`
    },
    {
      id: 'oidc',
      label: $localize`OIDC`,
      description: $localize`Use OpenID Connect for user authentication`
    },
    {
      id: 'saml',
      label: $localize`SAML`,
      description: $localize`Use SAML 2.0 for user authentication`
    }
  ]

  ngOnInit () {
    this.buildForm()

    this.form.valueChanges.subscribe(value => {
      this.usageType().patch(value)
    })
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      keepOriginalVideo: null,
      p2p: null,
      transcription: null,
      authType: null
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, this.usageType() as FormDefaultTyped<Form>)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }
}
