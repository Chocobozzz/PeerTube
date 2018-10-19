import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-button',
  styleUrls: ['./button.component.scss'],
  templateUrl: './button.component.html'
})

export class ButtonComponent {
  @Input() label = ''
  @Input() className: string = undefined
  @Input() icon: string = undefined
  @Input() title: string = undefined

  getTitle () {
    return this.title || this.label
  }
}
