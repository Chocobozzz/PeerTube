import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { MyAccountVideoChannelEdit } from './my-account-video-channel-edit'
import { VideoChannelUpdate } from '../../../../../shared/models/videos'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { Subscription } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { AuthService, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoChannelValidatorsService } from '@app/shared/forms/form-validators/video-channel-validators.service'

@Component({
  selector: 'my-account-video-channel-update',
  templateUrl: './my-account-video-channel-edit.component.html',
  styleUrls: [ './my-account-video-channel-edit.component.scss' ]
})
export class MyAccountVideoChannelUpdateComponent extends MyAccountVideoChannelEdit implements OnInit, OnDestroy {
  @ViewChild('avatarfileInput') avatarfileInput

  error: string

  videoChannelToUpdate: VideoChannel
  private paramsSub: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private videoChannelValidatorsService: VideoChannelValidatorsService,
    private notificationsService: NotificationsService,
    private router: Router,
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService,
    private i18n: I18n,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'display-name': this.videoChannelValidatorsService.VIDEO_CHANNEL_DISPLAY_NAME,
      description: this.videoChannelValidatorsService.VIDEO_CHANNEL_DESCRIPTION,
      support: this.videoChannelValidatorsService.VIDEO_CHANNEL_SUPPORT
    })

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoChannelId = routeParams['videoChannelId']

      this.videoChannelService.getVideoChannel(videoChannelId).subscribe(
        videoChannelToUpdate => {
          this.videoChannelToUpdate = videoChannelToUpdate

          this.form.patchValue({
            'display-name': videoChannelToUpdate.displayName,
            description: videoChannelToUpdate.description,
            support: videoChannelToUpdate.support
          })
        },

        err => this.error = err.message
      )
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelUpdate: VideoChannelUpdate = {
      displayName: body['display-name'],
      description: body.description || null,
      support: body.support || null
    }

    this.videoChannelService.updateVideoChannel(this.videoChannelToUpdate.name, videoChannelUpdate).subscribe(
      () => {
        this.authService.refreshUserInformation()
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Video channel {{videoChannelName}} updated.', { videoChannelName: videoChannelUpdate.displayName })
        )
        this.router.navigate([ '/my-account', 'video-channels' ])
      },

      err => this.error = err.message
    )
  }

  onAvatarChange (formData: FormData) {
    this.videoChannelService.changeVideoChannelAvatar(this.videoChannelToUpdate.name, formData)
        .subscribe(
          data => {
            this.notificationsService.success(this.i18n('Success'), this.i18n('Avatar changed.'))

            this.videoChannelToUpdate.updateAvatar(data.avatar)
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  get maxAvatarSize () {
    return this.serverService.getConfig().avatar.file.size.max
  }

  get avatarExtensions () {
    return this.serverService.getConfig().avatar.file.extensions.join(',')
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return this.i18n('Update')
  }
}
