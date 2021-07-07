import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { VideoChannelCreate } from '@shared/models'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { MyVideoChannelEdit } from './my-video-channel-edit'
import { switchMap } from 'rxjs/operators'
import { of } from 'rxjs'

@Component({
  templateUrl: './my-video-channel-edit.component.html',
  styleUrls: [ './my-video-channel-edit.component.scss' ]
})
export class MyVideoChannelCreateComponent extends MyVideoChannelEdit implements OnInit {
  error: string
  videoChannel = new VideoChannel({})

  private avatar: FormData
  private banner: FormData

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private router: Router,
    private videoChannelService: VideoChannelService
    ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      name: VIDEO_CHANNEL_NAME_VALIDATOR,
      'display-name': VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      description: VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      support: VIDEO_CHANNEL_SUPPORT_VALIDATOR
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

    this.videoChannelService.createVideoChannel(videoChannelCreate)
      .pipe(
        switchMap(() => this.uploadAvatar()),
        switchMap(() => this.uploadBanner())
      ).subscribe(
        () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Video channel ${videoChannelCreate.displayName} created.`)
          this.router.navigate(['/my-library', 'video-channels'])
        },

        err => {
          if (err.status === HttpStatusCode.CONFLICT_409) {
            this.error = $localize`This name already exists on this instance.`
            return
          }

          this.error = err.message
        }
      )
  }

  onAvatarChange (formData: FormData) {
    this.avatar = formData
  }

  onAvatarDelete () {
    this.avatar = null
  }

  onBannerChange (formData: FormData) {
    this.banner = formData
  }

  onBannerDelete () {
    this.banner = null
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return $localize`Create`
  }

  getUsername () {
    return this.form.value.name
  }

  private uploadAvatar () {
    if (!this.avatar) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(this.getUsername(), this.avatar, 'avatar')
  }

  private uploadBanner () {
    if (!this.banner) return of(undefined)

    return this.videoChannelService.changeVideoChannelImage(this.getUsername(), this.banner, 'banner')
  }
}
