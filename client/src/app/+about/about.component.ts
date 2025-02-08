import { CommonModule } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
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
  imports: [ CommonModule, RouterOutlet, HorizontalMenuComponent, GlobalIconComponent, ButtonComponent, SupportModalComponent ]
})

export class AboutComponent implements OnInit {
  @ViewChild('supportModal') supportModal: SupportModalComponent

  bannerUrl: string
  avatarUrl: string

  menuEntries: HorizontalMenuEntry[] = []

  config: HTMLServerConfig

  constructor (
    private server: ServerService
  ) {

  }

  ngOnInit () {
    this.config = this.server.getHTMLConfig()

    this.bannerUrl = this.config.instance.banners.length !== 0
      ? maxBy(this.config.instance.banners, 'width').path
      : undefined

    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.config.instance, 110)

    this.menuEntries = [
      {
        label: $localize`Platform`,
        routerLink: '/about/instance/home',
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
