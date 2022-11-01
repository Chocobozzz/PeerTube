import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { Params } from '@angular/router'
import { GlobalIconName } from '@app/shared/shared-icons'

export type DropdownAction<T> = {
  label?: string
  iconName?: GlobalIconName
  description?: string
  title?: string
  handler?: (a: T) => any

  linkBuilder?: (a: T) => (string | number)[]
  queryParamsBuilder?: (a: T) => Params

  isDisplayed?: (a: T) => boolean

  class?: string[]
  isHeader?: boolean
}

export type DropdownButtonSize = 'normal' | 'small'
export type DropdownTheme = 'orange' | 'grey'
export type DropdownDirection = 'horizontal' | 'vertical'

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  getQueryParams (action: DropdownAction<T>, entry: T) {
    if (action.queryParamsBuilder) return action.queryParamsBuilder(entry)

    return {}
  }

  areActionsDisplayed (actions: Array<DropdownAction<T> | DropdownAction<T>[]>, entry: T): boolean {
    return actions.some(a => {
      if (Array.isArray(a)) return this.areActionsDisplayed(a, entry)

      return a.isHeader !== true && (a.isDisplayed === undefined || a.isDisplayed(entry))
    })
  }
}
