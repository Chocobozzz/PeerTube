import { Component, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { LateralMenuComponent, LateralMenuConfig } from '../../shared/shared-main/menu/lateral-menu.component'

@Component({
  selector: 'my-admin-config',
  styleUrls: [ './admin-config.component.scss' ],
  templateUrl: './admin-config.component.html',
  imports: [
    RouterModule,
    LateralMenuComponent
  ]
})
export class AdminConfigComponent implements OnInit {
  menuConfig: LateralMenuConfig

  ngOnInit (): void {
    this.menuConfig = {
      title: $localize`Configuration`,
      entries: [
        {
          type: 'link',
          label: $localize`Information`,
          routerLink: 'information'
        },
        {
          type: 'link',
          label: $localize`Logo`,
          routerLink: 'logo'
        },
        {
          type: 'link',
          label: $localize`General`,
          routerLink: 'general'
        },
        {
          type: 'link',
          label: $localize`Homepage`,
          routerLink: 'homepage'
        },
        {
          type: 'link',
          label: $localize`Customization`,
          routerLink: 'customization'
        },

        { type: 'separator' },

        {
          type: 'link',
          label: $localize`VOD`,
          routerLink: 'vod'
        },
        {
          type: 'link',
          label: $localize`Live`,
          routerLink: 'live'
        },

        { type: 'separator' },

        {
          type: 'link',
          label: $localize`Advanced`,
          routerLink: 'advanced'
        }
      ]
    }
  }
}
