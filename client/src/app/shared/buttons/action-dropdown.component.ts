import { Component, Input } from '@angular/core'

export type DropdownAction<T> = {
  label?: string
  handler?: (T) => any
  linkBuilder?: (T) => (string | number)[]
  isDisplayed?: (T) => boolean
}

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html'
})

export class ActionDropdownComponent<T> {
  @Input() actions: DropdownAction<T>[] = []
  @Input() entry: T
  @Input() placement = 'left'
}
