import { CommonModule } from '@angular/common'
import { Component, inject, input } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { AbuseState, VideoChannelCollaboratorState, VideoState } from '@peertube/peertube-models'
import { AccountOnChannelAvatarComponent } from '../shared-actor-image/account-on-channel-avatar.component'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { VideoChannelService } from '../shared-main/channel/video-channel.service'
import { FromNowPipe } from '../shared-main/date/from-now.pipe'
import { UserNotification } from '../shared-main/users/user-notification.model'

@Component({
  selector: 'my-user-notification-content',
  templateUrl: 'user-notification-content.component.html',
  styleUrls: [ 'user-notification-content.component.scss' ],
  imports: [
    CommonModule,
    GlobalIconComponent,
    ActorAvatarComponent,
    AccountOnChannelAvatarComponent,
    FromNowPipe,
    ButtonComponent
  ]
})
export class UserNotificationContentComponent {
  readonly router = inject(Router)
  readonly notifier = inject(Notifier)
  readonly channelService = inject(VideoChannelService)
  readonly authService = inject(AuthService)

  readonly notification = input.required<UserNotification>()

  imageSize = 30

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

  acceptChannelCollab () {
    const collab = this.n.payload.videoChannelCollaborator

    this.channelService.acceptCollaboratorInvitation(collab.channel.name, collab.id)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.n.payload.videoChannelCollaborator.state.id = VideoChannelCollaboratorState.ACCEPTED
          this.n.url = this.n.buildChannelEditorsUrl(collab.channel)
          this.router.navigate(this.n.url)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  rejectChannelCollab () {
    const collab = this.n.payload.videoChannelCollaborator

    this.channelService.rejectCollaboratorInvitation(collab.channel.name, collab.id)
      .subscribe({
        next: () => {
          this.n.payload.videoChannelCollaborator.state.id = VideoChannelCollaboratorState.REJECTED
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
