import { AfterViewInit, Component, OnInit, inject, input, output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { VideoEdit } from '@app/+videos-publish-manage/shared-manage/common/video-edit.model'
import { VideoManageController } from '@app/+videos-publish-manage/shared-manage/video-manage-controller.service'
import { CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { LiveVideoLatencyMode, PeerTubeProblemDocument, ServerErrorCode, UserVideoQuota, VideoPrivacyType } from '@peertube/peertube-models'
import debug from 'debug'
import { map, switchMap } from 'rxjs'
import { SelectChannelItem } from 'src/types'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { VideoManageContainerComponent } from '../../shared-manage/video-manage-container.component'

const debugLogger = debug('peertube:video-publish')

@Component({
  selector: 'my-video-go-live',
  templateUrl: './video-go-live.component.html',
  styleUrls: [
    '../shared/common-publish.scss',
    './video-go-live.component.scss'
  ],
  imports: [
    GlobalIconComponent,
    SelectChannelComponent,
    FormsModule,
    ReactiveFormsModule,
    VideoManageContainerComponent
  ]
})
export class VideoGoLiveComponent implements OnInit, AfterViewInit, CanComponentDeactivate {
  private notifier = inject(Notifier)
  private serverService = inject(ServerService)
  private liveVideoService = inject(LiveVideoService)
  private hooks = inject(HooksService)
  private manageController = inject(VideoManageController)
  private route = inject(ActivatedRoute)

  readonly userChannels = input.required<SelectChannelItem[]>()
  readonly userQuota = input.required<UserVideoQuota>()
  readonly highestPrivacy = input.required<VideoPrivacyType>()

  readonly firstStepDone = output<string>()
  readonly firstStepError = output()

  firstStep = true
  firstStepChannelId: number
  firstStepPermanentLive: boolean

  private isGoingLive = false

  ngOnInit () {
    this.firstStepChannelId = this.userChannels()[0].id
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:go-live.init', 'video-edit')
  }

  canDeactivate () {
    if (this.firstStep) return { canDeactivate: true }

    let text = ''

    if (this.manageController.hasPendingChanges()) {
      text = $localize`Your live is waiting in your library. But there are unsaved changes: are you sure you want to leave this page?`
    }

    return { canDeactivate: !text, text }
  }

  reset () {
    this.firstStep = true
    this.isGoingLive = false
  }

  goLive () {
    if (this.isGoingLive) return
    this.isGoingLive = true

    const serverConfig = this.serverService.getHTMLConfig()

    const videoEdit = VideoEdit.createFromLive(serverConfig, {
      name: $localize`:The translation must be at least 3 characters long:Live`,
      channelId: this.firstStepChannelId,
      support: this.userChannels().find(c => c.id === this.firstStepChannelId).support ?? '',
      permanentLive: this.firstStepPermanentLive,
      latencyMode: LiveVideoLatencyMode.DEFAULT,
      saveReplay: this.isReplayAllowed(),
      replaySettings: { privacy: this.highestPrivacy() }
    })
    this.manageController.setConfig({ manageType: 'go-live', serverConfig: this.serverService.getHTMLConfig() })
    this.manageController.setVideoEdit(videoEdit)

    this.liveVideoService.goLive(videoEdit.toLiveCreate(this.highestPrivacy()))
      .pipe(
        switchMap(({ video }) => {
          return this.liveVideoService.getVideoLive(video.uuid)
            .pipe(map(live => ({ live, video })))
        })
      )
      .subscribe({
        next: async ({ video: { id, uuid, shortUUID }, live }) => {
          videoEdit.loadAfterPublish({ video: { id, uuid, shortUUID } })
          await videoEdit.loadFromAPI({ live })

          debugLogger(`Live published`)

          this.manageController.silentRedirectOnManage(shortUUID, this.route)

          this.firstStep = false
          this.isGoingLive = false
          this.firstStepDone.emit(videoEdit.getVideoAttributes().name)
        },

        error: err => {
          this.firstStepError.emit()

          let message = err.message
          const error = err.body as PeerTubeProblemDocument

          if (error?.code === ServerErrorCode.MAX_INSTANCE_LIVES_LIMIT_REACHED) {
            message = $localize`Cannot create live because this platform has too many created lives`
          } else if (error?.code === ServerErrorCode.MAX_USER_LIVES_LIMIT_REACHED) {
            message = $localize`Cannot create live because you created too many lives`
          }

          this.notifier.error(message)
          this.isGoingLive = false
        }
      })
  }

  onVideoUpdated () {
    this.notifier.success($localize`Changes saved.`)
  }

  getNormalLiveDescription () {
    if (this.isReplayAllowed()) {
      return $localize`Stream only once, replay will replace your live`
    }

    return $localize`Stream only once`
  }

  getPermanentLiveDescription () {
    if (this.isReplayAllowed()) {
      return $localize`Stream multiple times, replays will be separate videos`
    }

    return $localize`Stream multiple times using the same URL`
  }

  private isReplayAllowed () {
    return this.serverService.getHTMLConfig().live.allowReplay
  }
}
