import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'

@Component({
  templateUrl: './my-library.component.html',
  imports: [ RouterOutlet, HorizontalMenuComponent ]
})
export class MyLibraryComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []

  ngOnInit (): void {
    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = [
      {
        label: $localize`Playlists`,
        routerLink: '/my-library/video-playlists'
      },

      {
        label: $localize`Subscriptions`,
        routerLink: '/my-library/subscriptions'
      },

      {
        label: $localize`History`,
        routerLink: '/my-library/history/videos'
      }
    ]
  }
}
