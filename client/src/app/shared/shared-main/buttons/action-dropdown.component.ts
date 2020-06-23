import { Component, Input } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons'

export type DropdownAction<T> = {
  label?: string
  iconName?: GlobalIconName
  description?: string
  title?: string
  handler?: (a: T) => any
  linkBuilder?: (a: T) => (string | number)[]
  isDisplayed?: (a: T) => boolean
  isHeader?: boolean
}

export type DropdownButtonSize = 'normal' | 'small'
export type DropdownTheme = 'orange' | 'grey'
export type DropdownDirection = 'horizontal' | 'vertical'

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html'
})

export class ActionDropdownComponent<T> {
  @Input() actions: DropdownAction<T>[] | DropdownAction<T>[][] = []
  @Input() entry: T

  @Input() placement = 'bottom-left auto'
  @Input() container: null | 'body'

  @Input() buttonSize: DropdownButtonSize = 'normal'
  @Input() buttonDirection: DropdownDirection = 'horizontal'
  @Input() buttonStyled = true

  @Input() label: string
  @Input() theme: DropdownTheme = 'grey'

  getActions (): DropdownAction<T>[][] {
    if (this.actions.length !== 0 && Array.isArray(this.actions[0])) return this.actions as DropdownAction<T>[][]

    return [ this.actions as DropdownAction<T>[] ]
  }

  areActionsDisplayed (actions: Array<DropdownAction<T> | DropdownAction<T>[]>, entry: T): boolean {
    return actions.some(a => {
      if (Array.isArray(a)) return this.areActionsDisplayed(a, entry)

      return a.isDisplayed === undefined || a.isDisplayed(entry)
    })
  }
}
