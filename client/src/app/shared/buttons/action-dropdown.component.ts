import { Component, Input } from '@angular/core'

export type DropdownAction<T> = {
  type: 'custom' | 'delete' | 'edit'
  label?: string
  handler?: (T) => any
  linkBuilder?: (T) => (string | number)[]
  iconClass?: string
}

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html'
})

export class ActionDropdownComponent<T> {
  @Input() actions: DropdownAction<T>[] = []
  @Input() entry: T
}
