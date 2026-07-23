import { Component, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core'

/*
 * Allows to lazy load global player styles in the watch component
 */

@Component({
  selector: 'my-player-styles',
  template: '',
  styleUrls: [ './player-styles.component.scss' ],
  // eslint-disable-next-line @angular-eslint/use-component-view-encapsulation
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class PlayerStylesComponent {
}
