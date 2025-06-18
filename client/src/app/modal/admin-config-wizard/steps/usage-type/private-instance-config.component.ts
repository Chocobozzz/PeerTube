import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
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
import { EnabledDisabled, UsageType } from './usage-type.model'

type Form = {
  remoteImport: FormControl<EnabledDisabled>
  live: FormControl<EnabledDisabled>
  keepOriginalVideo: FormControl<EnabledDisabled>
}

@Component({
  selector: 'my-private-instance-config',
  templateUrl: './private-instance-config.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    SelectOptionsComponent
  ]
})
export class PrivateInstanceConfigComponent implements OnInit {
  private formReactiveService = inject(FormReactiveService)

  usageType = model.required<UsageType>()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  importOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: 'Enabled',
      description: 'Users can import videos from remote platforms (YouTube, Vimeo...) and automatically synchronize remote channels'
    },
    {
      id: 'disabled',
      label: 'Disabled',
      description: 'Disable video import and channel synchronization'
    }
  ]

  liveOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: 'Yes'
    },
    {
      id: 'disabled',
      label: 'No'
    }
  ]

  keepOriginalVideoOptions: SelectOptionsItem<EnabledDisabled>[] = [
    {
      id: 'enabled',
      label: 'Yes',
      description: 'Keep the original video file on the server'
    },
    {
      id: 'disabled',
      label: 'No',
      description: 'Delete the original video file after processing'
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
      remoteImport: null,
      live: null,
      keepOriginalVideo: null
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
