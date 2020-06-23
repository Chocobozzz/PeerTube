import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { FormValidatorService, VideoChannelValidatorsService } from '@app/shared/shared-forms'
import { VideoChannelService } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoChannelCreate } from '@shared/models'
import { MyAccountVideoChannelEdit } from './my-account-video-channel-edit'

@Component({
  selector: 'my-account-video-channel-create',
  templateUrl: './my-account-video-channel-edit.component.html',
  styleUrls: [ './my-account-video-channel-edit.component.scss' ]
})
export class MyAccountVideoChannelCreateComponent extends MyAccountVideoChannelEdit implements OnInit {
  error: string

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private videoChannelValidatorsService: VideoChannelValidatorsService,
    private notifier: Notifier,
    private router: Router,
    private videoChannelService: VideoChannelService,
    private i18n: I18n
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      name: this.videoChannelValidatorsService.VIDEO_CHANNEL_NAME,
      'display-name': this.videoChannelValidatorsService.VIDEO_CHANNEL_DISPLAY_NAME,
      description: this.videoChannelValidatorsService.VIDEO_CHANNEL_DESCRIPTION,
      support: this.videoChannelValidatorsService.VIDEO_CHANNEL_SUPPORT
    })
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelCreate: VideoChannelCreate = {
      name: body.name,
      displayName: body['display-name'],
      description: body.description || null,
      support: body.support || null
    }

    this.videoChannelService.createVideoChannel(videoChannelCreate).subscribe(
      () => {
        this.authService.refreshUserInformation()

        this.notifier.success(
          this.i18n('Video channel {{videoChannelName}} created.', { videoChannelName: videoChannelCreate.displayName })
        )
        this.router.navigate([ '/my-account', 'video-channels' ])
      },

      err => {
        if (err.status === 409) {
          this.error = this.i18n('This name already exists on this instance.')
          return
        }

        this.error = err.message
      }
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return this.i18n('Create')
  }
}
