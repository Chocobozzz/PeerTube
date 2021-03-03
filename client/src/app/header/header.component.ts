import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent {
  @Input() showPublishButton = true
}
