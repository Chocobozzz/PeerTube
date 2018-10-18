import { Component, Input } from '@angular/core'

export type DropdownAction<T> = {
  label?: string
  handler?: (a: T) => any
  linkBuilder?: (a: T) => (string | number)[]
  isDisplayed?: (a: T) => boolean
}

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html'
})

export class ActionDropdownComponent<T> {
  @Input() actions: DropdownAction<T>[] = []
  @Input() entry: T
  @Input() placement = 'bottom-left'
  @Input() buttonSize: 'normal' | 'small' = 'normal'
  @Input() label: string
  @Input() theme: 'orange' | 'grey' = 'grey'
}
