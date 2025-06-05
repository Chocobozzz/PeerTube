import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
import { Component, inject, model, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { getVideoQuotaOptions } from '@app/+admin/shared/user-quota-options'
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
import { EnabledDisabled, RegistrationType, UsageType } from './usage-type.model'

type Form = {
  registration: FormControl<RegistrationType>
  videoQuota: FormControl<number>
  remoteImport: FormControl<EnabledDisabled>
  live: FormControl<EnabledDisabled>
  globalSearch: FormControl<EnabledDisabled>
}

@Component({
  selector: 'my-community-based-config',
  templateUrl: './community-based-config.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    SelectOptionsComponent
  ]
})
export class CommunityBasedConfigComponent implements OnInit {
  private formReactiveService = inject(FormReactiveService)

  usageType = model.required<UsageType>()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  registrationOptions: SelectOptionsItem<RegistrationType>[] = [
    {
      id: 'open',
      label: 'Open',
      description: 'Anyone can register and use the platform'
    },

    {
      id: 'approval',
      label: 'Requires approval',
      description: 'Anyone can register, but a moderator must approve their account before they can use the platform'
    },
    {
      id: 'closed',
      label: 'Closed',
      description: 'Only an administrator can create users on the platform'
    }
  ]

  importOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: 'Enabled',
      description:
        'Your community can import videos from remote platforms (YouTube, Vimeo...) and automatically synchronize remote channels'
    },
    {
      id: 'disabled',
      label: 'Disabled',
      description: 'Your community cannot import or synchronize content from remote platforms'
    }
  ]

  liveOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: 'Yes',
      description: 'Your community can live stream on the platform (this requires extra moderation work)'
    },
    {
      id: 'disabled',
      label: 'No',
      description: 'Your community is not permitted to run live streams on the platform'
    }
  ]

  globalSearchOptions: SelectOptionsItem<string>[] = [
    {
      id: 'enabled',
      label: 'Enable global search',
      description: 'Use https://sepiasearch.org as default search engine to search for content across all known peertube platforms'
    },
    {
      id: 'disabled',
      label: 'Disable global search',
      description: 'Use your platform search engine which only displays local content'
    }
  ]

  videoQuotaOptions: SelectOptionsItem<number>[] = getVideoQuotaOptions()

  ngOnInit () {
    this.buildForm()

    this.form.valueChanges.subscribe(value => {
      this.usageType().patch(value)
    })
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      registration: null,
      remoteImport: null,
      videoQuota: null,
      live: null,
      globalSearch: null
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
