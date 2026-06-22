import { CommonModule } from '@angular/common'
import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { AbuseState, ChangeOwnershipState, VideoChannelCollaboratorState, VideoState } from '@peertube/peertube-models'
import { AccountOnChannelAvatarComponent } from '../shared-actor-image/account-on-channel-avatar.component'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { ChangeOwnershipService } from '../shared-change-ownership/change-ownership.service'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'
import { VideoChannelService } from '../shared-main/channel/video-channel.service'
import { FromNowPipe } from '../shared-main/date/from-now.pipe'
import { UserNotification } from '../shared-main/users/user-notification.model'

@Component({
  selector: 'my-user-notification-content',
  templateUrl: 'user-notification-content.component.html',
  styleUrls: [ 'user-notification-content.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    GlobalIconComponent,
    ActorAvatarComponent,
    AccountOnChannelAvatarComponent,
    FromNowPipe,
    ButtonComponent,
    CollaboratorStateComponent
  ]
})
export class UserNotificationContentComponent {
  readonly router = inject(Router)
  readonly notifier = inject(Notifier)
  readonly channelService = inject(VideoChannelService)
  readonly changeOwnershipService = inject(ChangeOwnershipService)
  readonly authService = inject(AuthService)

  readonly notification = input.required<UserNotification>()

  readonly buttonClicked = output()

  imageSize = 24

  get n () {
    return this.notification()
  }

  isAbuseAccepted (notification: UserNotification) {
    return notification.payload.abuse.state === AbuseState.ACCEPTED
  }

  isVideoPublished (notification: UserNotification) {
    return notification.payload.video.state.id === VideoState.PUBLISHED
  }

  // ---------------------------------------------------------------------------

  isChannelCollabInvitation (notification: UserNotification) {
    if (!notification.payload.videoChannelCollaborator) return false

    return notification.payload.videoChannelCollaborator.state.id === VideoChannelCollaboratorState.PENDING
  }

  isChannelCollabAccepted (notification: UserNotification) {
    if (!notification.payload.videoChannelCollaborator) return false

    return notification.payload.videoChannelCollaborator.state.id === VideoChannelCollaboratorState.ACCEPTED
  }

  isChannelCollabRejected (notification: UserNotification) {
    if (!notification.payload.videoChannelCollaborator) return false

    return notification.payload.videoChannelCollaborator.state.id === VideoChannelCollaboratorState.REJECTED
  }

  acceptChannelCollab (event: Event) {
    const collab = this.n.payload.videoChannelCollaborator

    event.preventDefault()
    event.stopPropagation()
    this.buttonClicked.emit()

    this.channelService.acceptCollaboratorInvitation(collab.channel.name, collab.id)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.n.payload.videoChannelCollaborator.state.id = VideoChannelCollaboratorState.ACCEPTED
          this.n.url = this.n.buildChannelUrl(collab.channel)
          this.router.navigate(this.n.url)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  rejectChannelCollab (event: Event) {
    const collab = this.n.payload.videoChannelCollaborator

    event.preventDefault()
    event.stopPropagation()
    this.buttonClicked.emit()

    this.channelService.rejectCollaboratorInvitation(collab.channel.name, collab.id)
      .subscribe({
        next: () => {
          this.n.payload.videoChannelCollaborator.state.id = VideoChannelCollaboratorState.REJECTED
        },

        error: err => this.notifier.handleError(err)
      })
  }

  // ---------------------------------------------------------------------------

  isOwnershipChangeRejected (notification: UserNotification) {
    if (!notification.payload.changeOwnership) return false

    return notification.payload.changeOwnership.state.id === ChangeOwnershipState.REJECTED
  }

  isOwnershipChangeAccepted (notification: UserNotification) {
    if (!notification.payload.changeOwnership) return false

    return notification.payload.changeOwnership.state.id === ChangeOwnershipState.ACCEPTED
  }

  isOwnershipChangeRequest (notification: UserNotification) {
    if (!notification.payload.changeOwnership) return false

    return notification.payload.changeOwnership.state.id === ChangeOwnershipState.PENDING
  }

  acceptChannelOwnershipChange (event: Event) {
    const changeOwnership = this.n.payload.changeOwnership

    event.preventDefault()
    event.stopPropagation()
    this.buttonClicked.emit()

    this.changeOwnershipService.acceptChannel([ changeOwnership.id ])
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.n.payload.changeOwnership.state.id = ChangeOwnershipState.ACCEPTED
          this.n.url = this.n.buildChannelUrl(changeOwnership.channel)
          this.router.navigate(this.n.url)
          this.notifier.success($localize`You are now the owner of the channel ${changeOwnership.channel.name}`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  rejectChannelOwnershipChange (event: Event) {
    const changeOwnership = this.n.payload.changeOwnership

    event.preventDefault()
    event.stopPropagation()
    this.buttonClicked.emit()

    this.changeOwnershipService.rejectChannel([ changeOwnership.id ])
      .subscribe({
        next: () => {
          this.n.payload.changeOwnership.state.id = ChangeOwnershipState.REJECTED
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
