import { Component, Input } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { RegisterClientFormFieldOptions } from '@peertube/peertube-models'

@Component({
  selector: 'my-dynamic-form-field',
  templateUrl: './dynamic-form-field.component.html',
  styleUrls: [ './dynamic-form-field.component.scss' ]
})

export class DynamicFormFieldComponent {
  @Input() form: FormGroup
  @Input() formErrors: any
  @Input() setting: RegisterClientFormFieldOptions

  hasDedicatedFormError () {
    const dedicated = new Set<RegisterClientFormFieldOptions['type']>([
      'input-checkbox',
      'input',
      'select',
      'input-textarea'
    ])

    return dedicated.has(this.setting.type)
  }
}
