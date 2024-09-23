import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import { Component, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLinkActive, RouterLink } from '@angular/router'
import { MenuService, ScreenService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbDropdown, NgbModal, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { NgClass, NgFor, NgIf } from '@angular/common'

export type TopMenuDropdownParam = {
  label: string
  routerLink?: string
  isDisplayed?: () => boolean // Default: () => true

  children?: {
    label: string
    routerLink: string
    queryParams?: { [id: string]: string }
    iconName: GlobalIconName

    isDisplayed?: () => boolean // Default: () => true
  }[]
}

@Component({
  selector: 'my-top-menu-dropdown',
  templateUrl: './top-menu-dropdown.component.html',
  styleUrls: [ './top-menu-dropdown.component.scss' ],
  standalone: true,
  imports: [
    NgClass,
    NgFor,
    NgIf,
    RouterLinkActive,
    RouterLink,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    GlobalIconComponent
  ]
})
export class TopMenuDropdownComponent implements OnInit, OnChanges, OnDestroy {
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

  get isBroadcastMessageDisplayed () {
    return this.screen.isBroadcastMessageDisplayed
  }

  ngOnInit () {
    this.updateChildLabels(window.location.pathname)

    this.routeSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateChildLabels(window.location.pathname))
  }

  ngOnChanges () {
    this.updateChildLabels(window.location.pathname)
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
      beforeDismiss: () => {
        this.onModalDismiss()

        return true
      }
    })
  }

  onModalDismiss () {
    this.isModalOpened = false
  }

  onActiveLinkScrollToTop (link: HTMLAnchorElement) {
    if (!this.isBroadcastMessageDisplayed && this.router.url.includes(link.getAttribute('href'))) {
      scrollToTop('smooth')
    }
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
