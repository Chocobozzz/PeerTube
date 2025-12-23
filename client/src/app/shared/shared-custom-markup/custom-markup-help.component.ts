import { booleanAttribute, Component, input } from '@angular/core'

@Component({
  selector: 'my-custom-markup-help',
  templateUrl: './custom-markup-help.component.html',
  standalone: true
})
export class CustomMarkupHelpComponent {
  readonly supportRelMe = input(false, { transform: booleanAttribute })
}
