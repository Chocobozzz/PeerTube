import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core'
import { filter, take } from 'rxjs/operators'
import { NavigationEnd, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconName } from '@app/shared/images/global-icon.component'
import { ScreenService } from '@app/shared/misc/screen.service'
import { MenuService } from '@app/core/menu'

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
  container: undefined | 'body' = undefined
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
    if (this.menuService.isMenuDisplayed) {
      const contentWidth = this.screen.getWindowInnerWidth() - this.menuService.menuWidth
      return contentWidth < 800
    }

    return this.screen.isInSmallView()
  }

  ngOnInit () {
    this.updateChildLabels(window.location.pathname)

    this.routeSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateChildLabels(window.location.pathname))

    this.hasIcons = this.menuEntries.some(
      e => e.children && e.children.some(c => !!c.iconName)
    )

    // We have to set body for the container to avoid scroll overflow on mobile and small views
    if (this.isInSmallView) {
      this.container = 'body'
    }
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
