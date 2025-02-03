import { Component, Input } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RegisterClientFormFieldOptions } from '@peertube/peertube-models'
import { MarkdownTextareaComponent } from './markdown-textarea.component'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { InputTextComponent } from './input-text.component'
import { PeertubeCheckboxComponent } from './peertube-checkbox.component'
import { NgIf, NgFor } from '@angular/common'

@Component({
  selector: 'my-dynamic-form-field',
  templateUrl: './dynamic-form-field.component.html',
  styleUrls: [ './dynamic-form-field.component.scss' ],
  imports: [
    NgIf,
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    NgFor,
    InputTextComponent,
    HelpComponent,
    MarkdownTextareaComponent
  ]
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
