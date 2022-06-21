import { CdkStep, CdkStepper } from '@angular/cdk/stepper'
import { Component } from '@angular/core'

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
    return step.completed
  }

  isAccessible (step: CdkStep) {
    return step.editable && step.completed
  }
}
