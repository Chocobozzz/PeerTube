import { CdkStepperModule } from '@angular/cdk/stepper'

import { Component, output, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'

@Component({
  selector: 'my-admin-config-wizard-welcome',
  templateUrl: './admin-config-wizard-welcome.component.html',
  styleUrls: [ '../shared/admin-config-wizard-modal-common.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, CdkStepperModule, ButtonComponent ]
})
export class AdminConfigWizardWelcomeComponent {
  readonly back = output()
  readonly next = output()
  readonly hide = output<{ doNotOpenAgain: boolean }>()
}
