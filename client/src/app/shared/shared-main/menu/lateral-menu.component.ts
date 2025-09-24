import { CommonModule } from '@angular/common'
import { Component, input } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent, GlobalIconName } from '../../shared-icons/global-icon.component'
import { UnavailableMenuEntryComponent } from './unavailable-menu-entry.component'

type LateralMenuLinkEntry = {
  type: 'link'
  label: string
  routerLink: string
  routerLinkActiveOptions?: { exact: boolean }

  icon?: GlobalIconName

  isDisplayed?: () => boolean
  unavailableText?: () => string
}

export type LateralMenuConfig = {
  title: string

  entries: ({ type: 'separator' } | LateralMenuLinkEntry)[]
}

@Component({
  selector: 'my-lateral-menu',
  styleUrls: [ './lateral-menu.component.scss' ],
  templateUrl: './lateral-menu.component.html',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    GlobalIconComponent,
    UnavailableMenuEntryComponent,
    GlobalIconComponent
  ]
})
export class LateralMenuComponent {
  config = input.required<LateralMenuConfig>()
  globalQueryParams = input<Record<string, any>>()

  isDisplayed (entry: LateralMenuLinkEntry) {
    if (!entry.isDisplayed) return true

    return entry.isDisplayed()
  }

  isUnavailable (entry: LateralMenuLinkEntry) {
    if (!entry.unavailableText) return false

    return !!entry.unavailableText()
  }
}
