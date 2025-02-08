import { Component, Input } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'my-edit-advanced-configuration',
  templateUrl: './edit-advanced-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, NgIf, HelpComponent, PeerTubeTemplateDirective ]
})
export class EditAdvancedConfigurationComponent {
  @Input() form: FormGroup
  @Input() formErrors: any

  getCacheSize (type: 'captions' | 'previews' | 'torrents' | 'storyboards') {
    return this.form.value['cache'][type]['size']
  }
}
