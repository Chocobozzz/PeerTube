import { AfterViewChecked, Component, inject, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoChannelUpdate } from '@peertube/peertube-models'
import { catchError, of, Subscription, switchMap, tap, throwError } from 'rxjs'
import { PlayerSettingsService } from '../../shared/shared-video/player-settings.service'
import { VideoChannelEditControllerService } from './edit/video-channel-edit-controller.service'
import { VideoChannelEditComponent } from './edit/video-channel-edit.component'
import { VideoChannelEdit } from './edit/video-channel-edit.model'
import { ChannelManageResolverData } from './routes'

@Component({
  selector: 'my-video-channel-manage',
  template: `
  <my-video-channel-edit [videoChannelEdit]="videoChannelEdit" [saveFn]="saveFn">
  </my-video-channel-edit>`,
  imports: [
    VideoChannelEditComponent
  ]
})
export class VideoChannelManageComponent implements OnInit, OnDestroy, AfterViewChecked, CanComponentDeactivate {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private route = inject(ActivatedRoute)
  private videoChannelService = inject(VideoChannelService)
  private playerSettingsService = inject(PlayerSettingsService)
  private hooks = inject(HooksService)
  private editControllerService = inject(VideoChannelEditControllerService)

  videoChannelEdit: VideoChannelEdit
  saveFn = this.save.bind(this)

  private runChannelInitHook = true
  private routeSub: Subscription

  ngOnInit () {
    this.editControllerService.setMode('update')

    this.routeSub = this.route.data.subscribe(d => {
      const data = d['data'] as ChannelManageResolverData

      this.videoChannelEdit = new VideoChannelEdit()

      this.videoChannelEdit.loadFromAPI({
        channel: data.videoChannel,
        playerSettings: data.rawPlayerSettings,
        collaborators: data.collaborators
      })

      this.editControllerService.setStore(this.videoChannelEdit)

      this.runChannelInitHook = true
    })
  }

  ngOnDestroy () {
    this.routeSub?.unsubscribe()
  }

  ngAfterViewChecked () {
    if (this.runChannelInitHook) {
      this.hooks.runAction('action:video-channel-update.init', 'video-channel')

      this.runChannelInitHook = false
    }
  }

  canDeactivate () {
    return { canDeactivate: !this.videoChannelEdit.hasChanges() }
  }

  save () {
    this.editControllerService.resetError()

    const videoChannelUpdate: VideoChannelUpdate = {
      displayName: this.videoChannelEdit.channel.displayName,
      description: this.videoChannelEdit.channel.description,
      support: this.videoChannelEdit.channel.support,
      bulkVideosSupportUpdate: this.videoChannelEdit.channel.bulkVideosSupportUpdate
    }

    return new Promise<void>(res => {
      this.videoChannelService.update(this.videoChannelEdit.channel.name, videoChannelUpdate)
        .pipe(
          switchMap(() => {
            return this.playerSettingsService.updateChannelSettings({
              channelHandle: this.videoChannelEdit.channel.name,
              settings: {
                theme: this.videoChannelEdit.playerSettings.theme
              }
            })
          }),
          switchMap(() => {
            return this.videoChannelEdit.avatarChanged
              ? this.updateOrDeleteAvatar(this.videoChannelEdit.avatar)
              : of(true)
          }),
          switchMap(() => {
            return this.videoChannelEdit.bannerChanged
              ? this.updateOrDeleteBanner(this.videoChannelEdit.banner)
              : of(true)
          })
        )
        .subscribe({
          next: () => {
            this.authService.refreshUserInformation()
            this.videoChannelEdit.resetChanges()

            this.notifier.success($localize`Video channel ${videoChannelUpdate.displayName} updated.`)

            res()
          },

          error: err => {
            this.editControllerService.setError(err.message)

            res()
          }
        })
    })
  }

  private updateOrDeleteAvatar (avatar: FormData) {
    if (!avatar) {
      return this.videoChannelService.deleteImage(this.videoChannelEdit.channel.name, 'avatar')
        .pipe(tap(() => this.videoChannelEdit.resetAvatarFromAPI()))
    }

    return this.videoChannelService.changeImage(this.videoChannelEdit.channel.name, avatar, 'avatar')
      .pipe(
        tap(data => this.videoChannelEdit.updateAvatarsFromAPI(data.avatars)),
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
      return this.videoChannelService.deleteImage(this.videoChannelEdit.channel.name, 'banner')
        .pipe(tap(() => this.videoChannelEdit.resetBannerFromAPI()))
    }

    return this.videoChannelService.changeImage(this.videoChannelEdit.channel.name, banner, 'banner')
      .pipe(
        tap(data => this.videoChannelEdit.updateBannerUrlFromAPI(VideoChannel.GET_ACTOR_BANNER_URL(data))),
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
