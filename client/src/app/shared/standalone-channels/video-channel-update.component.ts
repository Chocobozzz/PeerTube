import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, HooksService, Notifier, RedirectService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { shallowCopy } from '@peertube/peertube-core-utils'
import { PlayerChannelSettings, VideoChannelUpdate } from '@peertube/peertube-models'
import { catchError, forkJoin, Subscription, switchMap, tap, throwError } from 'rxjs'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { PlayerSettingsService } from '../shared-video/player-settings.service'
import { FormValidatedOutput, VideoChannelEditComponent } from './video-channel-edit.component'

@Component({
  selector: 'my-video-channel-update',
  template: `
  @if (channel && rawPlayerSettings) {
    <my-video-channel-edit
      mode="update" [channel]="channel" [rawPlayerSettings]="rawPlayerSettings" [error]="error"
      (formValidated)="onFormValidated($event)"
    >
    </my-video-channel-edit>
  }
  `,
  imports: [
    VideoChannelEditComponent
  ],
  providers: [
    PlayerSettingsService
  ]
})
export class VideoChannelUpdateComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private route = inject(ActivatedRoute)
  private videoChannelService = inject(VideoChannelService)
  private playerSettingsService = inject(PlayerSettingsService)
  private redirectService = inject(RedirectService)
  private hooks = inject(HooksService)

  channel: VideoChannel
  rawPlayerSettings: PlayerChannelSettings
  error: string

  private paramsSub: Subscription

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoChannelName = routeParams['videoChannelName']

      forkJoin([
        this.videoChannelService.getVideoChannel(videoChannelName),
        this.playerSettingsService.getChannelSettings({ channelHandle: videoChannelName, raw: true })
      ]).subscribe({
        next: ([ channel, rawPlayerSettings ]) => {
          this.channel = channel
          this.rawPlayerSettings = rawPlayerSettings

          this.hooks.runAction('action:video-channel-update.video-channel.loaded', 'video-channel', { videoChannel: this.channel })
        },

        error: err => this.notifier.error(err.message)
      })
    })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-update.init', 'video-channel')
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  onFormValidated (output: FormValidatedOutput) {
    this.error = undefined

    const videoChannelUpdate: VideoChannelUpdate = {
      displayName: output.channel.displayName,
      description: output.channel.description,
      support: output.channel.support,
      bulkVideosSupportUpdate: output.channel.bulkVideosSupportUpdate
    }

    this.videoChannelService.updateVideoChannel(this.channel.name, videoChannelUpdate)
      .pipe(
        switchMap(() => {
          return this.playerSettingsService.updateChannelSettings({
            channelHandle: this.channel.name,
            settings: {
              theme: output.playerSettings.theme
            }
          })
        }),
        switchMap(() => this.updateOrDeleteAvatar(output.avatar)),
        switchMap(() => this.updateOrDeleteBanner(output.banner))
      )
      .subscribe({
        next: () => {
          // So my-actor-avatar component detects changes
          this.channel = shallowCopy(this.channel)

          this.authService.refreshUserInformation()

          this.notifier.success($localize`Video channel ${videoChannelUpdate.displayName} updated.`)

          this.redirectService.redirectToPreviousRoute('/c/' + this.channel.name)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private updateOrDeleteAvatar (avatar: FormData) {
    if (!avatar) {
      return this.videoChannelService.deleteVideoChannelImage(this.channel.name, 'avatar')
        .pipe(tap(() => this.channel.resetAvatar()))
    }

    return this.videoChannelService.changeVideoChannelImage(this.channel.name, avatar, 'avatar')
      .pipe(
        tap(data => this.channel.updateAvatar(data.avatars)),
        catchError(err =>
          throwError(() => {
            return new Error(genericUploadErrorHandler({
              err,
              name: $localize`avatar`,
              notifier: this.notifier
            }))
          })
        )
      )
  }

  private updateOrDeleteBanner (banner: FormData) {
    if (!banner) {
      return this.videoChannelService.deleteVideoChannelImage(this.channel.name, 'banner')
        .pipe(tap(() => this.channel.resetBanner()))
    }

    return this.videoChannelService.changeVideoChannelImage(this.channel.name, banner, 'banner')
      .pipe(
        tap(data => this.channel.updateBanner(data.banners)),
        catchError(err =>
          throwError(() => {
            return new Error(genericUploadErrorHandler({
              err,
              name: $localize`banner`,
              notifier: this.notifier
            }))
          })
        )
      )
  }
}
