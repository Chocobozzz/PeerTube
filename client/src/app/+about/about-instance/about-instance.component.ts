import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, RouterOutlet } from '@angular/router'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { ServerConfig, ServerStats } from '@peertube/peertube-models'
import { ResolverData } from './about-instance.resolver'
import { InstanceStatRulesComponent } from './instance-stat-rules.component'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    InstanceStatRulesComponent,
    HorizontalMenuComponent,
    RouterOutlet
  ]
})
export class AboutInstanceComponent implements OnInit {
  private route = inject(ActivatedRoute)

  readonly descriptionWrapper = viewChild<ElementRef<HTMLInputElement>>('descriptionWrapper')

  aboutHTML: AboutHTML
  serverStats: ServerStats
  serverConfig: ServerConfig
  menuEntries: HorizontalMenuEntry[] = []

  ngOnInit () {
    const {
      about,
      aboutHTML,
      serverStats,
      serverConfig
    }: ResolverData = this.route.snapshot.data.instanceData

    this.serverStats = serverStats
    this.serverConfig = serverConfig

    this.aboutHTML = aboutHTML

    this.menuEntries = [
      {
        label: $localize`General`,
        routerLink: '/about/instance/home'
      }
    ]

    if (aboutHTML.administrator || aboutHTML.creationReason || aboutHTML.maintenanceLifetime || aboutHTML.businessModel) {
      this.menuEntries.push({
        label: $localize`Team`,
        routerLink: '/about/instance/team'
      })
    }

    if (aboutHTML.moderationInformation || aboutHTML.codeOfConduct) {
      this.menuEntries.push({
        label: $localize`Moderation and code of conduct`,
        routerLink: '/about/instance/moderation'
      })
    }

    // Always displayed, we have the "features found on this instance" table on this page
    this.menuEntries.push({
      label: $localize`Technical information`,
      routerLink: '/about/instance/tech'
    })

    if (about.instance.support.text) {
      this.menuEntries.push({
        label: $localize`Support`,
        routerLink: '/about/instance/support',
        // Only used to highlight the menu entry, not to display it
        isDisplayed: () => false
      })
    }

    if (serverConfig.email.enabled && serverConfig.contactForm.enabled) {
      this.menuEntries.push({
        label: $localize`Contact`,
        routerLink: '/about/instance/contact',
        // Only used to highlight the menu entry, not to display it
        isDisplayed: () => false
      })
    }
  }
}
