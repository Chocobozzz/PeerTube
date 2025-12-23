import { booleanAttribute, Component, inject, input, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { LateralMenuComponent, LateralMenuConfig } from '@app/shared/shared-main/menu/lateral-menu.component'
import { getReplaceFileUnavailability, getStudioUnavailability } from './common/unavailable-features'
import { VideoEdit } from './common/video-edit.model'
import { VideoManageController } from './video-manage-controller.service'

@Component({
  selector: 'my-video-manage-menu',
  template: '<my-lateral-menu [config]="menuConfig" [globalQueryParams]="globalQueryParams" />',
  imports: [
    LateralMenuComponent
  ]
})
export class VideoManageMenuComponent implements OnInit {
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)

  readonly canWatch = input.required<boolean, string | boolean>({ transform: booleanAttribute })

  menuConfig: LateralMenuConfig

  // Remove these query params when navigating between pages
  // They are added by the stats page
  globalQueryParams: Record<string, any> = {
    startDate: null,
    endDate: null
  }

  private videoEdit: VideoEdit
  private replaceFileEnabled: boolean
  private studioEnabled: boolean
  private instanceName: string

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()
    this.studioEnabled = config.videoStudio.enabled === true
    this.instanceName = config.instance.name
    this.replaceFileEnabled = config.videoFile.update.enabled === true

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit

    this.menuConfig = {
      title: $localize``,

      entries: [
        {
          type: 'link',
          label: $localize`Main information`,
          routerLinkActiveOptions: { exact: true },
          icon: 'film',
          routerLink: '.'
        },
        {
          type: 'link',
          isDisplayed: () => this.getVideo().isLive,
          label: $localize`Live settings`,
          icon: 'live',
          routerLink: 'live-settings'
        },

        {
          type: 'separator'
        },

        {
          type: 'link',
          label: $localize`Customization`,
          icon: 'cog',
          routerLink: 'customization'
        },
        {
          type: 'link',
          label: $localize`Moderation`,
          icon: 'moderation',
          routerLink: 'moderation'
        },
        {
          type: 'link',
          isDisplayed: () => !this.getVideo().isLive,
          label: $localize`Captions`,
          icon: 'captions',
          routerLink: 'captions'
        },
        {
          type: 'link',
          isDisplayed: () => !this.getVideo().isLive,
          label: $localize`Chapters`,
          icon: 'chapters',
          routerLink: 'chapters'
        },

        {
          type: 'separator'
        },

        {
          type: 'link',
          label: $localize`Studio`,
          icon: 'studio',
          routerLink: 'studio',
          unavailableText: () => this.studioUnavailable()
        },
        {
          type: 'link',
          label: $localize`Replace file`,
          icon: 'upload',
          routerLink: 'replace-file',
          unavailableText: () => this.replaceFileUnavailable()
        },

        {
          type: 'separator'
        },

        {
          type: 'link',
          isDisplayed: () => this.canWatch(),
          label: $localize`Statistics`,
          icon: 'stats',
          routerLink: 'stats'
        }
      ]
    }
  }

  getVideo () {
    return this.videoEdit.getVideoAttributes()
  }

  studioUnavailable () {
    return getStudioUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      studioEnabled: this.studioEnabled
    })
  }

  replaceFileUnavailable () {
    return getReplaceFileUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      replaceFileEnabled: this.replaceFileEnabled
    })
  }
}
