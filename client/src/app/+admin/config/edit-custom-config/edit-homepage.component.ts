import { Component, inject, input } from '@angular/core'
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
  private customMarkup = inject(CustomMarkupService)

  readonly form = input<FormGroup>(undefined)
  readonly formErrors = input<any>(undefined)

  customMarkdownRenderer: (text: string) => Promise<HTMLElement>

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }
}
