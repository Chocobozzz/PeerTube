import { Component, input } from '@angular/core'
import { MascotImageName, SignupMascotComponent } from './signup-mascot.component'

@Component({
  selector: 'my-signup-step-title',
  templateUrl: './signup-step-title.component.html',
  styleUrls: [ './signup-step-title.component.scss' ],
  imports: [ SignupMascotComponent ]
})
export class SignupStepTitleComponent {
  readonly mascotImageName = input<MascotImageName>(undefined)
}
