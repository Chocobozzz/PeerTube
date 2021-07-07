import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'

@Component({
  selector: 'my-edit-homepage',
  templateUrl: './edit-homepage.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
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
