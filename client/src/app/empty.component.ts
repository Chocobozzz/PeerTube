import { Component, ChangeDetectionStrategy } from '@angular/core'

@Component({
  selector: 'my-empty',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class EmptyComponent {

}
