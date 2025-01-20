import { booleanAttribute, Component, Input } from '@angular/core'

@Component({
  selector: 'my-custom-markup-help',
  templateUrl: './custom-markup-help.component.html',
  standalone: true
})
export class CustomMarkupHelpComponent {
  @Input({ transform: booleanAttribute }) supportRelMe = false
}
