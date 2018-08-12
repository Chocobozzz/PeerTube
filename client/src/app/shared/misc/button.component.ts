import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-button',
  styleUrls: ['./button.component.scss'],
  templateUrl: './button.component.html'
})

export class ButtonComponent {
  private static baseClassName = 'action-button'
  private static baseIconName = 'icon'

  @Input() label = ''
  @Input() className = undefined
  @Input() icon = undefined
  @Input() title = undefined

  getClassName () {
    return this.className
      ? `${ButtonComponent.baseClassName} ${this.className}`
      : ButtonComponent.baseClassName
  }

  getIconName () {
    return this.icon
      ? `${ButtonComponent.baseIconName} ${this.icon}`
      : ButtonComponent.baseIconName
  }

  getTitle () {
    return this.title || this.label
  }
}
