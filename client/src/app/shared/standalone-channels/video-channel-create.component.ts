import { AfterViewInit, Component, inject } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, HooksService, Notifier } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { HttpStatusCode, PlayerChannelSettings, VideoChannelCreate } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { PlayerSettingsService } from '../shared-video/player-settings.service'
import { FormValidatedOutput, VideoChannelEditComponent } from './video-channel-edit.component'

@Component({
  template: `
  <my-video-channel-edit
    mode="create" [channel]="channel" [rawPlayerSettings]="rawPlayerSettings" [error]="error"
    (formValidated)="onFormValidated($event)"
  >
  </my-video-channel-edit>
  `,
  imports: [
    VideoChannelEditComponent
  ],
  providers: [
    PlayerSettingsService
  ]
})
export class VideoChannelCreateComponent implements AfterViewInit {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private router = inject(Router)
  private videoChannelService = inject(VideoChannelService)
  private hooks = inject(HooksService)
  private playerSettingsService = inject(PlayerSettingsService)

  error: string
  channel = new VideoChannel({})
  rawPlayerSettings: PlayerChannelSettings = {
    theme: 'instance-default'
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-create.init', 'video-channel')
  }

  onFormValidated (output: FormValidatedOutput) {
    this.error = undefined

    const channelCreate: VideoChannelCreate = {
      name: output.channel.name,
      displayName: output.channel.displayName,
      description: output.channel.description,
      support: output.channel.support
    }

    this.videoChannelService.createVideoChannel(channelCreate)
      .pipe(
        switchMap(() => {
          return this.playerSettingsService.updateChannelSettings({
            channelHandle: output.channel.name,
            settings: {
              theme: output.playerSettings.theme
            }
          })
        }),
        switchMap(() => this.uploadAvatar(output.channel.name, output.avatar)),
        switchMap(() => this.uploadBanner(output.channel.name, output.banner))
      ).subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Video channel ${channelCreate.displayName} created.`)
          this.router.navigate([ '/my-library', 'video-channels' ])
        },

        error: err => {
          let message = err.message

          if (err.status === HttpStatusCode.CONFLICT_409) {
            message = $localize`Channel name "${channelCreate.name}" already exists on this platform.`
          }

          this.notifier.error(message)
        }
      })
  }

  private uploadAvatar (username: string, avatar?: FormData) {
    if (!avatar) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(username, avatar, 'avatar')
  }

  private uploadBanner (username: string, banner?: FormData) {
    if (!banner) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(username, banner, 'banner')
  }
}
