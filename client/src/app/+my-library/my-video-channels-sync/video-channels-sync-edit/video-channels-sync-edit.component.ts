import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { VideoChannelService } from '@app/shared/shared-main'
import { VideoChannelsSyncService } from '@app/shared/shared-main/video-channels-sync/video-channels-sync.service'
import { VideoChannel, VideoChannelsSyncCreate } from '@shared/models/videos'
import { mergeMap } from 'rxjs'

@Component({
  selector: 'my-video-channels-sync-edit',
  templateUrl: './video-channels-sync-edit.component.html',
  styleUrls: [ './video-channels-sync-edit.component.scss' ]
})
export class VideoChannelsSyncEditComponent extends FormReactive implements OnInit {
  error: string
  selectedVideoChannel: VideoChannel
  videoChannels: VideoChannel[]

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoChannelService: VideoChannelService,
    private authService: AuthService,
    private router: Router,
    private notifier: Notifier,
    private videoChannelsSyncService: VideoChannelsSyncService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      url: VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR,
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
    const videoChannelName = this.selectedVideoChannel.displayName
    const videoChannelsSyncCreate: VideoChannelsSyncCreate = {
      url: body.url,
      videoChannel: body['video-channel']
    }
    this.videoChannelsSyncService.createSync(videoChannelsSyncCreate)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          this.notifier.success($localize`Synchronization created successfully for ${videoChannelName}.`)
          this.router.navigate([ '/my-library', 'video-channels-sync' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }
}
