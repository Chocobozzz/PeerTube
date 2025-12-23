import { CommonModule, NgTemplateOutlet } from '@angular/common'
import { booleanAttribute, ChangeDetectionStrategy, Component, ContentChild, input, OnChanges, output, TemplateRef } from '@angular/core'
import { Params, RouterLink } from '@angular/router'
import { ActorAvatarComponent, ActorAvatarInput, ActorAvatarType } from '@app/shared/shared-actor-image/actor-avatar.component'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbDropdownMenu, NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { CollaboratorStateType } from '../channel/collaborator-state.component'

export type DropdownAction<T, D = never> = {
  label: string

  iconName?: GlobalIconName

  actorAvatar?: {
    actor: ActorAvatarInput
    type: ActorAvatarType
  }
  collaboratorBadge?: CollaboratorStateType

  description?: string
  title?: string
  handler?: (a: T) => any

  linkBuilder?: (a: T) => (string | number)[]
  queryParamsBuilder?: (a: T) => Params

  isDisplayed?: (a: T) => boolean

  class?: string[]
  isHeader?: boolean

  ownerOrModeratorPrivilege?: () => string

  data?: D
}

export type DropdownButtonSize = 'normal' | 'small'
export type DropdownTheme = 'primary' | 'secondary'
export type DropdownButtonIcon = 'more-horizontal' | 'more-vertical' | 'chevron-down'

@Component({
  selector: 'my-action-dropdown',
  styleUrls: [ './action-dropdown.component.scss' ],
  templateUrl: './action-dropdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgbTooltipModule,
    NgbDropdownModule,
    GlobalIconComponent,
    NgbDropdownMenu,
    RouterLink,
    NgTemplateOutlet,
    ActorAvatarComponent
  ]
})
export class ActionDropdownComponent<T, D = never> implements OnChanges {
  readonly actions = input<DropdownAction<T, D>[] | DropdownAction<T, D>[][]>([])
  readonly entry = input<T>(undefined)

  readonly placement = input('bottom-left auto')
  readonly container = input<null | 'body'>(undefined)

  readonly buttonSize = input<DropdownButtonSize>('normal')
  readonly buttonIcon = input<DropdownButtonIcon>('more-horizontal')
  readonly buttonStyled = input(true, { transform: booleanAttribute })

  readonly label = input<string>(undefined)
  readonly theme = input<DropdownTheme>('secondary')

  readonly openChange = output<boolean>()

  @ContentChild('dropdownItemExtra', { descendants: false })
  dropdownItemExtra: TemplateRef<any>

  @ContentChild('labelExtra', { descendants: false })
  labelExtra: TemplateRef<any>

  buttonClasses: Record<string, boolean> = {}

  ngOnChanges () {
    this.buttonClasses = {
      'icon-only': !this.label(),
      'peertube-button': this.buttonStyled(),
      'peertube-button-small': this.buttonSize() === 'small',
      'secondary-button': this.buttonStyled() && this.theme() === 'secondary',
      'primary-button': this.buttonStyled() && this.theme() === 'primary',
      'button-unstyle': !this.buttonStyled()
    }
  }

  getActions (): DropdownAction<T, D>[][] {
    const actions = this.actions()
    if (actions.length !== 0 && Array.isArray(actions[0])) return actions as DropdownAction<T, D>[][]

    return [ actions as DropdownAction<T, D>[] ]
  }

  getQueryParams (action: DropdownAction<T, D>, entry: T) {
    if (action.queryParamsBuilder) return action.queryParamsBuilder(entry)

    return {}
  }

  areActionsDisplayed (actions: (DropdownAction<T, D> | DropdownAction<T, D>[])[], entry: T): boolean {
    return actions.some(a => {
      if (Array.isArray(a)) return this.areActionsDisplayed(a, entry)

      return a.isHeader !== true && (a.isDisplayed === undefined || a.isDisplayed(entry))
    })
  }

  isBlockDisplayed (allActions: (DropdownAction<T, D> | DropdownAction<T, D>[])[], action: DropdownAction<T, D>, entry: T) {
    // Do not display only the header
    if (action.isHeader && !this.areActionsDisplayed(allActions, entry)) return false

    return action.isDisplayed === undefined || action.isDisplayed(entry) === true
  }
}
