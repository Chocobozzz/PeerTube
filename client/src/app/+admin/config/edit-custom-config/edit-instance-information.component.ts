import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'

@Component({
  selector: 'my-edit-instance-information',
  templateUrl: './edit-instance-information.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditInstanceInformationComponent {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() languageItems: SelectOptionsItem[] = []
  @Input() categoryItems: SelectOptionsItem[] = []

  constructor (private customMarkup: CustomMarkupService) {

  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }
}
