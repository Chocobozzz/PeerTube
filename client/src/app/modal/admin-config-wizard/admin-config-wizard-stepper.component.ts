import { CdkStepper } from '@angular/cdk/stepper'
import { CommonModule, NgTemplateOutlet } from '@angular/common'
import { Component } from '@angular/core'

@Component({
  selector: 'my-admin-config-wizard-stepper',
  templateUrl: './admin-config-wizard-stepper.component.html',
  providers: [ { provide: CdkStepper, useExisting: AdminConfigWizardStepperComponent } ],
  imports: [ CommonModule, NgTemplateOutlet ]
})
export class AdminConfigWizardStepperComponent extends CdkStepper {
}
