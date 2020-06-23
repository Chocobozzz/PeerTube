import { Subscription } from 'rxjs'
import { filter, take } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { MenuService, ScreenService } from '@app/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap'

export type TopMenuDropdownParam = {
  label: string
  routerLink?: string

  children?: {
    label: string
    routerLink: string

    iconName?: GlobalIconName
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

  private openedOnHover = false
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

  openDropdownOnHover (dropdown: NgbDropdown) {
    this.openedOnHover = true
    dropdown.open()

    // Menu was closed
    dropdown.openChange
            .pipe(take(1))
            .subscribe(() => this.openedOnHover = false)
  }

  dropdownAnchorClicked (dropdown: NgbDropdown) {
    if (this.openedOnHover) {
      this.openedOnHover = false
      return
    }

    return dropdown.toggle()
  }

  closeDropdownIfHovered (dropdown: NgbDropdown) {
    if (this.openedOnHover === false) return

    dropdown.close()
    this.openedOnHover = false
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
