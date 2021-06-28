import { Component, Input, ViewEncapsulation } from '@angular/core'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html'
})
export class LinkComponent {
  @Input() internalLink?: string | any[]

  @Input() href?: string
  @Input() target?: string

  @Input() title?: string

  @Input() tabindex: string | number
}
