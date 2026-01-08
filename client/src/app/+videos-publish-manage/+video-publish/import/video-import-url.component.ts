import { AfterViewInit, Component, OnInit, inject, input, output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { VideoEdit } from '@app/+videos-publish-manage/shared-manage/common/video-edit.model'
import { VideoManageController } from '@app/+videos-publish-manage/shared-manage/video-manage-controller.service'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { UserVideoQuota, VideoPrivacyType } from '@peertube/peertube-models'
import debug from 'debug'
import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { VideoManageContainerComponent } from '../../shared-manage/video-manage-container.component'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'

const debugLogger = debug('peertube:video-publish')

@Component({
  selector: 'my-video-import-url',
  templateUrl: './video-import-url.component.html',
  styleUrls: [ '../shared/common-publish.scss' ],
  imports: [
    GlobalIconComponent,
    HelpComponent,
    FormsModule,
    RouterLink,
    SelectChannelComponent,
    ReactiveFormsModule,
    AlertComponent,
    VideoManageContainerComponent
  ]
})
export class VideoImportUrlComponent implements OnInit, AfterViewInit, CanComponentDeactivate {
  private authService = inject(AuthService)
  private loadingBar = inject(LoadingBarService)
  private notifier = inject(Notifier)
  private videoService = inject(VideoService)
  private videoImportService = inject(VideoImportService)
  private hooks = inject(HooksService)
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)
  private route = inject(ActivatedRoute)
  private chapterService = inject(VideoChapterService)
  private captionService = inject(VideoCaptionService)
  private playerSettingsService = inject(PlayerSettingsService)

  readonly userChannels = input.required<SelectChannelItem[]>()
  readonly userQuota = input.required<UserVideoQuota>()
  readonly highestPrivacy = input.required<VideoPrivacyType>()

  readonly firstStepDone = output<string>()
  readonly firstStepError = output()

  targetUrl = ''

  firstStep = true
  firstStepChannelId: number

  isImportingVideo = false

  ngOnInit () {
    this.firstStepChannelId = this.userChannels()[0].id
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-url-import.init', 'video-edit')
  }

  canDeactivate () {
    if (this.firstStep) return { canDeactivate: true }

    let text = ''

    if (this.manageController.hasPendingChanges()) {
      text = $localize`Your video is being imported. But there are unsaved changes: are you sure you want to leave this page?`
    }

    return { canDeactivate: !text, text }
  }

  onVideoUpdated () {
    this.notifier.success($localize`Changes saved.`)
  }

  reset () {
    this.firstStep = true
    this.isImportingVideo = false
  }

  isTargetUrlValid () {
    return this.targetUrl?.match(/https?:\/\//)
  }

  isChannelSyncEnabled () {
    return this.serverService.getHTMLConfig().import.videoChannelSynchronization.enabled
  }

  importVideo () {
    if (this.isImportingVideo) return
    this.isImportingVideo = true

    const serverConfig = this.serverService.getHTMLConfig()

    const videoEdit = VideoEdit.createFromImport(serverConfig, {
      targetUrl: this.targetUrl,
      channelId: this.firstStepChannelId,
      support: this.userChannels().find(c => c.id === this.firstStepChannelId).support ?? '',
      user: this.authService.getUser()
    })
    this.manageController.setConfig({ manageType: 'import-url', serverConfig: this.serverService.getHTMLConfig() })
    this.manageController.setVideoEdit(videoEdit)

    this.loadingBar.useRef().start()

    this.videoImportService.importVideo(videoEdit.toVideoImportCreate(this.highestPrivacy()))
      .pipe(
        switchMap(({ video }) => {
          return forkJoin([
            this.captionService.listCaptions(video.uuid),
            this.chapterService.getChapters({ videoId: video.uuid }),
            this.playerSettingsService.getVideoSettings({ videoId: video.uuid, raw: true }),
            this.videoService.getVideo({ videoId: video.uuid })
          ]).pipe(map(([ { data: captions }, { chapters }, playerSettings, video ]) => ({ captions, chapters, playerSettings, video })))
        })
      )
      .subscribe({
        next: async ({ video, playerSettings, captions, chapters }) => {
          await videoEdit.loadFromAPI({ video, captions, playerSettings, chapters, loadPrivacy: false })

          this.loadingBar.useRef().complete()

          debugLogger(`URL import created`)

          this.manageController.silentRedirectOnManage(videoEdit.getVideoAttributes().shortUUID, this.route)

          this.firstStep = false
          this.isImportingVideo = false
          this.firstStepDone.emit(videoEdit.getVideoAttributes().name)
        },

        error: err => {
          this.loadingBar.useRef().complete()
          this.isImportingVideo = false
          this.firstStepError.emit()
          this.notifier.handleError(err)
        }
      })
  }
}
