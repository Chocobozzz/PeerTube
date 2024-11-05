import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'

@Component({
  selector: 'my-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [ RouterOutlet, HorizontalMenuComponent ]
})

export class AboutComponent {
  menuEntries: HorizontalMenuEntry[] = [
    {
      label: $localize`Platform`,
      routerLink: '/about/instance',
      pluginSelectorId: 'about-menu-instance'
    },
    {
      label: $localize`PeerTube`,
      routerLink: '/about/peertube',
      pluginSelectorId: 'about-menu-peertube'
    },
    {
      label: $localize`Network`,
      routerLink: '/about/follows',
      pluginSelectorId: 'about-menu-network'
    }
  ]
}
