import { Component, output } from '@angular/core'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'

@Component({
  selector: 'my-admin-config-wizard-documentation',
  templateUrl: './admin-config-wizard-documentation.component.html',
  styleUrls: [ '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [ ButtonComponent ]
})
export class AdminConfigWizardDocumentationComponent {
  readonly hide = output()
}
