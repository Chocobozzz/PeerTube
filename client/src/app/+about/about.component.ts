import { Component, OnInit, inject, viewChild } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ServerService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { maxBy } from '@peertube/peertube-core-utils'
import { HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  selector: 'my-about',
  templateUrl: './about.component.html',
  styleUrls: [ './about.component.scss' ],
  imports: [ RouterOutlet, HorizontalMenuComponent, GlobalIconComponent, ButtonComponent ]
})
export class AboutComponent implements OnInit {
  private server = inject(ServerService)

  readonly supportModal = viewChild<SupportModalComponent>('supportModal')

  bannerUrl: string
  avatarUrl: string

  menuEntries: HorizontalMenuEntry[] = []

  config: HTMLServerConfig

  ngOnInit () {
    this.config = this.server.getHTMLConfig()

    this.bannerUrl = this.config.instance.banners.length !== 0
      ? maxBy(this.config.instance.banners, 'width').fileUrl
      : undefined

    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.config.instance, 110)

    this.menuEntries = [
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

  isContactFormEnabled () {
    return this.config.email.enabled && this.config.contactForm.enabled
  }
}
