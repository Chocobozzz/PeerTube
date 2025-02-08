import { Component, Input } from '@angular/core'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-feature-boolean',
  templateUrl: './feature-boolean.component.html',
  styleUrls: [ './feature-boolean.component.scss' ],
  imports: [ NgIf, GlobalIconComponent ]
})
export class FeatureBooleanComponent {
  @Input() value: boolean
}
