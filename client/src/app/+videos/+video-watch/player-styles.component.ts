import { Component, ViewEncapsulation } from '@angular/core'

/*
* Allows to lazy load global player styles in the watch component
*/

@Component({
  selector: 'my-player-styles',
  template: '',
  styleUrls: [ './player-styles.component.scss' ],
  /* eslint-disable @angular-eslint/use-component-view-encapsulation */
  encapsulation: ViewEncapsulation.None,
  standalone: true
})
export class PlayerStylesComponent {
}
