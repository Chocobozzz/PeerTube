import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannelService, VideoChannelSyncService } from '@app/shared/shared-main'
import { VideoChannel, VideoChannelSyncCreate } from '@shared/models/videos'
import { mergeMap } from 'rxjs'

@Component({
  selector: 'my-video-channel-sync-edit',
  templateUrl: './video-channel-sync-edit.component.html',
  styleUrls: [ './video-channel-sync-edit.component.scss' ]
})
export class VideoChannelSyncEditComponent extends FormReactive implements OnInit {
  error: string
  selectedVideoChannel: VideoChannel
  videoChannels: VideoChannel[]

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoChannelService: VideoChannelService,
    private authService: AuthService,
    private router: Router,
    private notifier: Notifier,
    private videoChannelSyncService: VideoChannelSyncService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      externalChannelUrl: VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR,
      'video-channel': null
    })
    this.authService.userInformationLoaded
        .pipe(mergeMap(() => {
          const user = this.authService.getUser()
          const options = {
            account: user.account
          }

          return this.videoChannelService.listAccountVideoChannels(options)
        })).subscribe(res => {
          this.videoChannels = res.data
        })
  }

  getFormButtonTitle () {
    return $localize`Create`
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelSyncCreate: VideoChannelSyncCreate = {
      externalChannelUrl: body.externalChannelUrl,
      videoChannel: body['video-channel']
    }
    this.videoChannelSyncService.createSync(videoChannelSyncCreate)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Synchronization created successfully.`)
          this.router.navigate([ '/my-library', 'video-channels-sync' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }
}
