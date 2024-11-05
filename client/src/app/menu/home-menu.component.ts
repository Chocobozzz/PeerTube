import { Component, OnInit } from '@angular/core'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'

@Component({
  selector: 'my-home-menu',
  templateUrl: './home-menu.component.html',
  standalone: true,
  imports: [ HorizontalMenuComponent ]
})
export class HomeMenuComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []

  constructor (
    private server: ServerService,
    private authService: AuthService
  ) {

  }

  ngOnInit () {
    const config = this.server.getHTMLConfig()
    this.menuEntries = []

    if (config.homepage.enabled) {
      this.menuEntries.push({ label: $localize`Home`, routerLink: '/home' })
    }

    this.menuEntries.push({ label: $localize`Discover`, routerLink: '/videos/overview' })

    if (this.authService.isLoggedIn()) {
      this.menuEntries.push({ label: $localize`Subscriptions`, routerLink: '/videos/subscriptions' })
    }

    this.menuEntries.push({ label: $localize`Browse videos`, routerLink: '/videos/browse' })
  }
}
