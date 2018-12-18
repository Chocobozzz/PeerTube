import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { filter, take } from 'rxjs/operators'
import { NavigationEnd, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'

export type TopMenuDropdownParam = {
  label: string
  routerLink?: string

  children?: {
    label: string
    routerLink: string
  }[]
}

@Component({
  selector: 'my-top-menu-dropdown',
  templateUrl: './top-menu-dropdown.component.html',
  styleUrls: [ './top-menu-dropdown.component.scss' ]
})
export class TopMenuDropdownComponent implements OnInit, OnDestroy {
  @Input() menuEntries: TopMenuDropdownParam[] = []

  suffixLabels: { [ parentLabel: string ]: string }

  private openedOnHover = false
  private routeSub: Subscription

  constructor (private router: Router) {}

  ngOnInit () {
    this.updateChildLabels(window.location.pathname)

    this.routeSub = this.router.events
                        .pipe(filter(event => event instanceof NavigationEnd))
                        .subscribe(() => this.updateChildLabels(window.location.pathname))
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
            .subscribe(e => this.openedOnHover = false)
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
