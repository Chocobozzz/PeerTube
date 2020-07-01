import { Component, Input } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons'

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
  @Input() disabled = false

  getTitle () {
    return this.title || this.label
  }

  getClasses () {
    return {
      [this.className]: true,
      disabled: this.disabled
    }
  }
}
