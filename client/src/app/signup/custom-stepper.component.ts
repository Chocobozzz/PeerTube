import { Component } from '@angular/core'
import { CdkStep, CdkStepper } from '@angular/cdk/stepper'

@Component({
  selector: 'my-custom-stepper',
  templateUrl: './custom-stepper.component.html',
  styleUrls: [ './custom-stepper.component.scss' ],
  providers: [ { provide: CdkStepper, useExisting: CustomStepperComponent } ]
})
export class CustomStepperComponent extends CdkStepper {

  onClick (index: number): void {
    this.selectedIndex = index
  }

  isCompleted (step: CdkStep) {
    return step.stepControl && step.stepControl.dirty && step.stepControl.valid
  }
}
