import { Component, inject, input, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, RouterOutlet } from '@angular/router'
import { AuthService } from '@app/core'
import { ActionDropdownComponent, DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { HorizontalMenuService } from '@app/shared/shared-main/menu/horizontal-menu.service'
import { VideoChannel } from '@peertube/peertube-models'
import { LateralMenuComponent, LateralMenuConfig } from '../../../shared/shared-main/menu/lateral-menu.component'
import { EditMode, VideoChannelEditControllerService } from './video-channel-edit-controller.service'
import { VideoChannelEdit } from './video-channel-edit.model'

@Component({
  selector: 'my-video-channel-edit',
  templateUrl: './video-channel-edit.component.html',
  styleUrls: [ './video-channel-edit.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LateralMenuComponent,
    RouterOutlet,
    ButtonComponent,
    AlertComponent,
    RouterModule,
    ActionDropdownComponent,
    CollaboratorStateComponent
  ]
})
export class VideoChannelEditComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private horizontalMenuService = inject(HorizontalMenuService)

  readonly videoChannelEdit = input.required<VideoChannelEdit>()
  readonly saveFn = input.required<() => Promise<any>>()

  private editControllerService = inject(VideoChannelEditControllerService)

  mode: EditMode
  menuConfig: LateralMenuConfig
  displayFormErrorsMsg = false

  switchChannelActions: DropdownAction<void, { editor: boolean }>[] = []

  private isSaving = false

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.mode = this.editControllerService.getMode()

    this.menuConfig = {
      title: this.mode === 'create'
        ? $localize`Create channel`
        : $localize`Manage my channel`,

      entries: [
        {
          type: 'link',
          icon: 'channel',
          label: $localize`General`,
          routerLink: 'general'
        },
        {
          type: 'link',
          icon: 'users',
          label: $localize`Editors`,
          routerLink: 'editors',
          isDisplayed: () => this.mode === 'update'
        },

        {
          type: 'separator'
        },

        {
          type: 'link',
          icon: 'calendar',
          label: $localize`Activity`,
          routerLink: 'activities',
          isDisplayed: () => this.mode === 'update'
        }
      ]
    }

    this.buildSwitchChannelActions()

    this.editControllerService.setStore(this.videoChannelEdit())

    this.horizontalMenuService.setMenuHidden(true)
  }

  ngOnDestroy () {
    this.horizontalMenuService.setMenuHidden(false)
  }

  private buildSwitchChannelActions () {
    const user = this.authService.getUser()

    const builder = (c: VideoChannel, { editor, owner, collaborate }: { editor: boolean, owner: boolean, collaborate: boolean }) => ({
      label: c.displayName,
      linkBuilder: () => {
        const current = this.videoChannelEdit().channel.name

        const suffix = window.location.pathname.replace(`/my-library/video-channels/manage/${current}/`, '')

        return [ '/my-library/video-channels/manage', c.name, suffix ]
      },
      actorAvatar: {
        actor: c,
        type: 'channel' as const
      },

      data: {
        collaborate,
        editor,
        owner
      }
    })

    const collaborate = user.isCollaboratingToChannels()

    this.switchChannelActions = [
      ...user.videoChannels.map(c => builder(c, { editor: false, owner: true, collaborate })),
      ...user.videoChannelCollaborations.map(c => builder(c, { editor: true, owner: false, collaborate }))
    ]
  }

  // ---------------------------------------------------------------------------

  getError () {
    return this.editControllerService.getError()
  }

  getAllFormErrors () {
    return this.editControllerService.getFormErrors()
  }
  // ---------------------------------------------------------------------------

  getChannelPublicUrl () {
    return '/c/' + this.videoChannelEdit().channel.name
  }

  cancelLink () {
    return '/my-library/video-channels'
  }

  canUpdate () {
    return this.videoChannelEdit().hasChanges() && !this.editControllerService.hasFormErrors()
  }

  hasFormErrors () {
    return this.editControllerService.hasFormErrors()
  }

  async onSaveClick () {
    this.displayFormErrorsMsg = false

    await this.editControllerService.runSaveHook()

    if (this.hasFormErrors()) {
      this.displayFormErrorsMsg = true
      return
    }

    if (this.isSaving) return
    this.isSaving = true

    try {
      await this.saveFn()()
    } finally {
      this.isSaving = false
    }
  }
}
