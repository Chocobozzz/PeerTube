import { NgClass } from '@angular/common'
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { REQUIRED_VALIDATOR } from '@app/shared/form-validators/common-validators'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { VIDEO_PRIVACY_VALIDATOR } from '@app/shared/form-validators/video-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { listChannelsForSelect } from '@app/shared/shared-forms/select/channel/select-channel-helpers'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { VideoChannelSyncService } from '@app/shared/shared-main/channel/video-channel-sync.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoChannelSyncCreate, VideoPrivacy } from '@peertube/peertube-models'
import { SelectChannelItem, SelectOptionsItem } from '@pt-types'
import { mergeMap } from 'rxjs'
import { SelectChannelUserComponent } from '../../../shared/shared-forms/select/channel/select-channel-user.component'

@Component({
  selector: 'my-video-channel-sync-edit',
  templateUrl: './video-channel-sync-edit.component.html',
  styleUrls: [ './video-channel-sync-edit.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, NgClass, SelectChannelUserComponent, AlertComponent, SelectOptionsComponent ]
})
export class VideoChannelSyncEditComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private router = inject(Router)
  private notifier = inject(Notifier)
  private videoChannelSyncService = inject(VideoChannelSyncService)
  private videoChannelService = inject(VideoChannelService)
  private serverService = inject(ServerService)
  private videoService = inject(VideoService)

  error: string
  channels: SelectChannelItem[] = []
  existingVideosStrategy: string
  videoPrivacies: SelectOptionsItem[] = []

  ngOnInit () {
    this.buildForm({
      externalChannelUrl: VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR,
      videoChannel: REQUIRED_VALIDATOR,
      existingVideoStrategy: REQUIRED_VALIDATOR,
      videoPrivacy: VIDEO_PRIVACY_VALIDATOR
    })

    listChannelsForSelect({
      authService: this.authService,
      includeCollaborations: true
    }).subscribe(channels => this.channels = channels)

    this.serverService.getVideoPrivacies()
      .subscribe(privacies => {
        const allowedPrivacies = privacies.filter(p => p.id !== VideoPrivacy.PASSWORD_PROTECTED)

        this.videoPrivacies = this.videoService.explainedPrivacyLabels(allowedPrivacies).videoPrivacies
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
      videoChannelId: body.videoChannel,
      videoPrivacy: body.videoPrivacy
    }

    const importExistingVideos = body['existingVideoStrategy'] === 'import'

    this.videoChannelSyncService.create(videoChannelSyncCreate)
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
