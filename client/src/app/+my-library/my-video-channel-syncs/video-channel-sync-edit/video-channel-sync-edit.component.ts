import { forkJoin, map, mergeMap } from 'rxjs'
import { SelectChannelItem } from 'src/types'
import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR } from '@app/shared/form-validators/video-channel-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { VideoChannelService, VideoChannelSyncService } from '@app/shared/shared-main'
import { VideoChannelSyncCreate, VideoConstant } from '@shared/models/videos'
import { InstanceService } from '@app/shared/shared-instance'

type VideoLanguages = VideoConstant<string> & {group?: string}

@Component({
  selector: 'my-video-channel-sync-edit',
  templateUrl: './video-channel-sync-edit.component.html',
  styleUrls: [ './video-channel-sync-edit.component.scss' ]
})
export class VideoChannelSyncEditComponent extends FormReactive implements OnInit {
  error: string
  userVideoChannels: SelectChannelItem[] = []
  existingVideosStrategy: string
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoLanguages[] = []

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private instanceService: InstanceService,
    private serverService: ServerService,
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
      videoChannel: null,
      existingVideoStrategy: null
    })

    listUserChannelsForSelect(this.authService)
      .subscribe(channels => this.userVideoChannels = channels)
    this.serverService.getVideoLicences()
      .subscribe(res => {
        this.videoLicences = res
      })

    forkJoin([
      this.instanceService.getAbout(),
      this.serverService.getVideoLanguages()
    ]).pipe(map(([ about, languages ]) => ({ about, languages })))
      .subscribe(res => {
        this.videoLanguages = res.languages
          .map(l => {
            if (l.id === 'zxx') return { ...l, group: $localize`Other`, groupOrder: 1 }

            return res.about.instance.languages.includes(l.id)
              ? { ...l, group: $localize`Instance languages`, groupOrder: 0 }
              : { ...l, group: $localize`All languages`, groupOrder: 2 }
          })
          .sort((a, b) => a.groupOrder - b.groupOrder)
      })
  }

  getFormButtonTitle () {
    return $localize`Create`
  }

  getLicencePlaceholder () {
    return $localize`Determined with remote information`
  }

  getLanguagePlaceholder () {
    return $localize`Determined with remote information`
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
