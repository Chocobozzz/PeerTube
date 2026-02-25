import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier } from '@app/core'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { UserAutoCompleteComponent } from '@app/shared/shared-forms/user-auto-complete.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoChannelCollaborator, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { Subscription } from 'rxjs'
import { VideoChannelEditControllerService } from '../video-channel-edit-controller.service'
import { VideoChannelEdit } from '../video-channel-edit.model'

@Component({
  selector: 'my-video-channel-editors',
  templateUrl: './video-channel-editors.component.html',
  styleUrls: [ './video-channel-editors.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ActorAvatarComponent,
    ButtonComponent,
    ActionDropdownComponent,
    UserAutoCompleteComponent,
    GlobalIconComponent,
    CollaboratorStateComponent
  ]
})
export class VideoChannelEditEditorsComponent implements OnInit, OnDestroy {
  private confirmService = inject(ConfirmService)
  private notifier = inject(Notifier)
  private channelService = inject(VideoChannelService)
  private editController = inject(VideoChannelEditControllerService)
  private authService = inject(AuthService)
  private router = inject(Router)

  videoChannelEdit: VideoChannelEdit

  newEditorUsername: string
  collaboratorActions: DropdownAction<VideoChannelCollaborator>[] = []

  private storeSub: Subscription

  ngOnInit () {
    this.videoChannelEdit = this.editController.getStore()

    this.storeSub = this.editController.getStoreChangesObs()
      .subscribe(() => {
        this.videoChannelEdit = this.editController.getStore()
      })

    this.buildActions()
  }

  ngOnDestroy () {
    this.storeSub?.unsubscribe()
  }

  private buildActions () {
    this.collaboratorActions = [
      {
        label: $localize`Delete`,
        iconName: 'delete',
        handler: async collaborator => {
          const message = collaborator.state.id === VideoChannelCollaboratorState.PENDING
            // eslint-disable-next-line max-len
            ? $localize`Are you sure you want to remove invitation of <strong>${collaborator.account.displayName}</strong> to collaborate on your channel?`
            : $localize`Are you sure you want to remove <strong>${collaborator.account.displayName}</strong> as a collaborator?`

          const res = await this.confirmService.confirm(
            message,
            $localize`Remove collaborator`
          )
          if (!res) return

          this.channelService.removeCollaborator(this.videoChannelEdit.channel.name, collaborator.id)
            .subscribe({
              next: () => {
                this.videoChannelEdit.collaborators = this.videoChannelEdit.collaborators.filter(c => c.id !== collaborator.id)

                if (this.isCollaborator(collaborator)) {
                  this.notifier.success(
                    $localize`You have been removed as a collaborator from ${this.videoChannelEdit.channel.name} channel`
                  )

                  this.router.navigate([ '/my-library', 'video-channels' ])
                }
              },

              error: err => this.notifier.handleError(err)
            })
        }
      }
    ]
  }

  // ---------------------------------------------------------------------------

  getOwnerAccount () {
    return this.videoChannelEdit.apiInfo.ownerAccount
  }

  getOwnerDisplayName () {
    return this.getOwnerAccount().displayName
  }

  isOwner () {
    return this.getOwnerAccount().id === this.authService.getUser().account.id
  }

  isCollaborator (collaborator: VideoChannelCollaborator) {
    return collaborator.account.id === this.authService.getUser().account.id
  }

  getCollaboratorState (collaborator: VideoChannelCollaborator) {
    if (collaborator.state.id === VideoChannelCollaboratorState.ACCEPTED) return 'accepted' as const
    if (collaborator.state.id === VideoChannelCollaboratorState.PENDING) return 'invited' as const

    logger.error('Cannot find collaborator state for  ' + collaborator.state.id)

    return undefined
  }

  // ---------------------------------------------------------------------------

  async addEditor () {
    const message =
      // eslint-disable-next-line max-len
      $localize`Do you want to send an invitation to <strong>${this.newEditorUsername}</strong> to collaborate on <strong>${this.videoChannelEdit.channel.name}</strong>?`

    const res = await this.confirmService.confirm(message, $localize`Invite new editor`)
    if (!res) return

    this.channelService.inviteCollaborator(this.videoChannelEdit.channel.name, this.newEditorUsername)
      .subscribe({
        next: collaborator => {
          this.videoChannelEdit.collaborators.push(collaborator)
          this.newEditorUsername = ''
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
