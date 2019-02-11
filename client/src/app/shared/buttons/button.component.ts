import { Component, Input } from '@angular/core'
import { GlobalIconName } from '@app/shared/icons/global-icon.component'

@Component({
  selector: 'my-button',
  styleUrls: ['./button.component.scss'],
  templateUrl: './button.component.html'
})

export class ButtonComponent {
  @Input() label = ''
  @Input() className: string = undefined
  @Input() icon: GlobalIconName = undefined
  @Input() title: string = undefined

  getTitle () {
    return this.title || this.label
  }
}
