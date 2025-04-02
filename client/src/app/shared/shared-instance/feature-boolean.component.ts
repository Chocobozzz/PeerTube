import { Component, input } from '@angular/core'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-feature-boolean',
  templateUrl: './feature-boolean.component.html',
  styleUrls: [ './feature-boolean.component.scss' ],
  imports: [ GlobalIconComponent ]
})
export class FeatureBooleanComponent {
  readonly value = input<boolean>(undefined)
}
