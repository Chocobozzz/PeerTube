import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { MenuService, ScreenService } from '@app/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap'

export type TopMenuDropdownParam = {
  label: string
  routerLink?: string
  isDisplayed?: () => boolean // Default: () => true

  children?: {
    label: string
    routerLink: string
    iconName?: GlobalIconName

    isDisplayed?: () => boolean // Default: () => true
  }[]
}

@Component({
  selector: 'my-top-menu-dropdown',
  templateUrl: './top-menu-dropdown.component.html',
  styleUrls: [ './top-menu-dropdown.component.scss' ]
})
export class TopMenuDropdownComponent implements OnInit, OnDestroy {
  @Input() menuEntries: TopMenuDropdownParam[] = []

  @ViewChild('modal', { static: true }) modal: NgbModal

  suffixLabels: { [ parentLabel: string ]: string }
  hasIcons = false
  isModalOpened = false
  currentMenuEntryIndex: number

  private routeSub: Subscription

  constructor (
    private router: Router,
    private modalService: NgbModal,
    private screen: ScreenService,
    private menuService: MenuService
  ) { }

  get isInSmallView () {
    let marginLeft = 0
    if (this.menuService.isMenuDisplayed) {
      marginLeft = this.menuService.menuWidth
    }

    return this.screen.isInSmallView(marginLeft)
  }

  ngOnInit () {
    this.updateChildLabels(window.location.pathname)

    this.routeSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateChildLabels(window.location.pathname))

    this.hasIcons = this.menuEntries.some(
      e => e.children && e.children.some(c => !!c.iconName)
    )
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  dropdownAnchorClicked (dropdown: NgbDropdown) {
    return dropdown.toggle()
  }

  openModal (index: number) {
    this.currentMenuEntryIndex = index
    this.isModalOpened = true

    this.modalService.open(this.modal, {
      centered: true,
      beforeDismiss: async () => {
        this.onModalDismiss()
        return true
      }
    })
  }

  onModalDismiss () {
    this.isModalOpened = false
  }

  dismissOtherModals () {
    this.modalService.dismissAll()
  }

  isDisplayed (obj: { isDisplayed?: () => boolean }) {
    if (typeof obj.isDisplayed !== 'function') return true

    return obj.isDisplayed()
  }

  private updateChildLabels (path: string) {
    this.suffixLabels = {}

    for (const entry of this.menuEntries) {
      if (!entry.children) continue

      for (const child of entry.children) {
        if (path.startsWith(child.routerLink)) {
          this.suffixLabels[entry.label] = child.label
        }
      }
    }
  }
}
