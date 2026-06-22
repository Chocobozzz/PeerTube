import { CdkStepper } from '@angular/cdk/stepper'
import { CommonModule, NgTemplateOutlet } from '@angular/common'
import { Component, ChangeDetectionStrategy } from '@angular/core'

@Component({
  selector: 'my-common-stepper',
  template: `<div>
    <div [ngTemplateOutlet]="selected ? selected.content : null"></div>
  </div>`,
  providers: [ { provide: CdkStepper, useExisting: CommonStepperComponent } ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ CommonModule, NgTemplateOutlet ]
})
export class CommonStepperComponent extends CdkStepper {
}
