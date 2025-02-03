import { Component, Input } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NgIf } from '@angular/common'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'

@Component({
  selector: 'my-edit-homepage',
  templateUrl: './edit-homepage.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, CustomMarkupHelpComponent, MarkdownTextareaComponent, NgIf ]
})
export class EditHomepageComponent {
  @Input() form: FormGroup
  @Input() formErrors: any

  customMarkdownRenderer: (text: string) => Promise<HTMLElement>

  constructor (private customMarkup: CustomMarkupService) {

  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }
}
