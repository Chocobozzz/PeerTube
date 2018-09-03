import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-button',
  styleUrls: ['./button.component.scss'],
  templateUrl: './button.component.html'
})

export class ButtonComponent {
  @Input() label = ''
  @Input() className = undefined
  @Input() icon = undefined
  @Input() title = undefined

  getTitle () {
    return this.title || this.label
  }
}
