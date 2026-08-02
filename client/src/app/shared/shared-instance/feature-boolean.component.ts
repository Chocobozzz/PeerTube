import { Component, input, ChangeDetectionStrategy } from '@angular/core'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-feature-boolean',
  templateUrl: './feature-boolean.component.html',
  styleUrls: [ './feature-boolean.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ GlobalIconComponent ]
})
export class FeatureBooleanComponent {
  readonly value = input<boolean>(undefined)
}
