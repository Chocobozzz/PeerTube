import { AfterViewInit, Component, inject, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier } from '@app/core'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { HttpStatusCode } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { PlayerSettingsService } from '../../shared/shared-video/player-settings.service'
import { VideoChannelEditControllerService } from './edit/video-channel-edit-controller.service'
import { VideoChannelEditComponent } from './edit/video-channel-edit.component'
import { VideoChannelEdit } from './edit/video-channel-edit.model'

@Component({
  template: `
  <my-video-channel-edit [videoChannelEdit]="videoChannelEdit" [saveFn]="saveFn">
  </my-video-channel-edit>
  `,
  imports: [
    VideoChannelEditComponent
  ]
})
export class VideoChannelCreateComponent implements OnInit, AfterViewInit, CanComponentDeactivate {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private videoChannelService = inject(VideoChannelService)
  private hooks = inject(HooksService)
  private playerSettingsService = inject(PlayerSettingsService)
  private editControllerService = inject(VideoChannelEditControllerService)
  private router = inject(Router)

  videoChannelEdit = new VideoChannelEdit()
  saveFn = this.save.bind(this)

  ngOnInit (): void {
    this.videoChannelEdit.loadFromCreate({
      user: this.authService.getUser(),
      playerSettings: {
        theme: 'instance-default'
      }
    })

    this.editControllerService.setStore(this.videoChannelEdit)
    this.editControllerService.setMode('create')
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-create.init', 'video-channel')
  }

  canDeactivate () {
    return { canDeactivate: !this.videoChannelEdit.hasChanges() }
  }

  save () {
    this.editControllerService.resetError()

    return new Promise<void>(res => {
      this.videoChannelService.create(this.videoChannelEdit.channel)
        .pipe(
          switchMap(() => {
            return this.playerSettingsService.updateChannelSettings({
              channelHandle: this.videoChannelEdit.channel.name,
              settings: {
                theme: this.videoChannelEdit.playerSettings.theme
              }
            })
          }),
          switchMap(() => this.uploadAvatar(this.videoChannelEdit.channel.name, this.videoChannelEdit.avatar)),
          switchMap(() => this.uploadBanner(this.videoChannelEdit.channel.name, this.videoChannelEdit.banner))
        ).subscribe({
          next: () => {
            this.authService.refreshUserInformation()

            this.notifier.success($localize`Video channel ${this.videoChannelEdit.channel.displayName} created.`)

            this.videoChannelEdit.resetChanges()
            this.router.navigate([ '/my-library/video-channels/manage', this.videoChannelEdit.channel.name ])

            res()
          },

          error: err => {
            let message = err.message

            if (err.status === HttpStatusCode.CONFLICT_409) {
              message = $localize`Channel name "${this.videoChannelEdit.channel.name}" already exists on this platform.`
            }

            this.editControllerService.setError(message)

            res()
          }
        })
    })
  }

  private uploadAvatar (name: string, avatar?: FormData) {
    if (!avatar) return of(undefined)

    return this.videoChannelService.changeImage(name, avatar, 'avatar')
  }

  private uploadBanner (name: string, banner?: FormData) {
    if (!banner) return of(undefined)

    return this.videoChannelService.changeImage(name, banner, 'banner')
  }
}
