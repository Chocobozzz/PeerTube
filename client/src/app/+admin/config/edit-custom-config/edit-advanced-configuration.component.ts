import { NgClass, NgIf } from '@angular/common'
import { Component, input } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'

@Component({
  selector: 'my-edit-advanced-configuration',
  templateUrl: './edit-advanced-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, NgIf, HelpComponent ]
})
export class EditAdvancedConfigurationComponent {
  readonly form = input<FormGroup>(undefined)
  readonly formErrors = input<any>(undefined)

  getCacheSize (type: 'captions' | 'previews' | 'torrents' | 'storyboards') {
    return this.form().value['cache'][type]['size']
  }
}
