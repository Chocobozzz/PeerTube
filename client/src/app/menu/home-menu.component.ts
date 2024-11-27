import { Component, OnDestroy, OnInit } from '@angular/core'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-home-menu',
  templateUrl: './home-menu.component.html',
  standalone: true,
  imports: [ HorizontalMenuComponent ]
})
export class HomeMenuComponent implements OnInit, OnDestroy {
  menuEntries: HorizontalMenuEntry[] = []

  private sub: Subscription

  constructor (
    private server: ServerService,
    private authService: AuthService
  ) {

  }

  ngOnInit () {
    this.buildMenu()

    this.sub = this.authService.loginChangedSource
      .subscribe(() => this.buildMenu())
  }

  ngOnDestroy () {
    if (this.sub) this.sub.unsubscribe()
  }

  buildMenu () {
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
