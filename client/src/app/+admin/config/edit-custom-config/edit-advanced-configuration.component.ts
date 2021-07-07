import { Component, Input } from '@angular/core'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-edit-advanced-configuration',
  templateUrl: './edit-advanced-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditAdvancedConfigurationComponent {
  @Input() form: FormGroup
  @Input() formErrors: any

  getCacheSize (type: 'captions' | 'previews' | 'torrents') {
    return this.form.value['cache'][type]['size']
  }
}
