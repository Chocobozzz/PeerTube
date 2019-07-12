import { Component, Input } from '@angular/core'
import { GlobalIconName } from '@app/shared/images/global-icon.component'

@Component({
  selector: 'my-button',
  styleUrls: ['./button.component.scss'],
  templateUrl: './button.component.html'
})

export class ButtonComponent {
  @Input() label = ''
  @Input() className = 'grey-button'
  @Input() icon: GlobalIconName = undefined
  @Input() title: string = undefined
  @Input() loading = false

  getTitle () {
    return this.title || this.label
  }
}
