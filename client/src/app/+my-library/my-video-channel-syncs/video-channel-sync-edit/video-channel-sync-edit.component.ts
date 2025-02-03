import { NgClass, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoChannelSyncService } from '@app/shared/shared-main/channel/video-channel-sync.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoChannelSyncCreate } from '@peertube/peertube-models'
import { mergeMap } from 'rxjs'
import { SelectChannelItem } from 'src/types'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { REQUIRED_VALIDATOR } from '@app/shared/form-validators/common-validators'

@Component({
  selector: 'my-video-channel-sync-edit',
  templateUrl: './video-channel-sync-edit.component.html',
  styleUrls: [ './video-channel-sync-edit.component.scss' ],
  imports: [ NgIf, FormsModule, ReactiveFormsModule, NgClass, SelectChannelComponent, AlertComponent ]
})
export class VideoChannelSyncEditComponent extends FormReactive implements OnInit {
  error: string
  userVideoChannels: SelectChannelItem[] = []
  existingVideosStrategy: string

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private router: Router,
    private notifier: Notifier,
    private videoChannelSyncService: VideoChannelSyncService,
    private videoChannelService: VideoChannelService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      externalChannelUrl: VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR,
      videoChannel: REQUIRED_VALIDATOR,
      existingVideoStrategy: REQUIRED_VALIDATOR
    })

    listUserChannelsForSelect(this.authService)
      .subscribe(channels => this.userVideoChannels = channels)
  }

  getFormButtonTitle () {
    return $localize`Create`
  }

  formValidated () {
    this.error = undefined

    const body = this.form.value
    const videoChannelSyncCreate: VideoChannelSyncCreate = {
      externalChannelUrl: body.externalChannelUrl,
      videoChannelId: body.videoChannel
    }

    const importExistingVideos = body['existingVideoStrategy'] === 'import'

    this.videoChannelSyncService.createSync(videoChannelSyncCreate)
      .pipe(mergeMap(({ videoChannelSync }) => {
        return importExistingVideos
          ? this.videoChannelService.importVideos(videoChannelSync.channel.name, videoChannelSync.externalChannelUrl, videoChannelSync.id)
          : Promise.resolve(null)
      }))
      .subscribe({
        next: () => {
          this.notifier.success($localize`Synchronization created successfully.`)
          this.router.navigate([ '/my-library', 'video-channel-syncs' ])
        },

        error: err => {
          this.error = err.message
        }
      })
  }
}
