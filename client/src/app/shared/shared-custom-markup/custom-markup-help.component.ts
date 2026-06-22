import { booleanAttribute, Component, input, ChangeDetectionStrategy } from '@angular/core'

@Component({
  selector: 'my-custom-markup-help',
  templateUrl: './custom-markup-help.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class CustomMarkupHelpComponent {
  readonly supportRelMe = input(false, { transform: booleanAttribute })
}
