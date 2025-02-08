import { NgIf } from '@angular/common'
import { AfterViewInit, Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoEdit } from '@app/shared/shared-main/video/video-edit.model'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoUpdate } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { hydrateFormFromVideo } from '../shared/video-edit-utils'
import { VideoEditComponent } from '../shared/video-edit.component'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-import-url',
  templateUrl: './video-import-url.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-send.scss'
  ],
  imports: [
    NgIf,
    GlobalIconComponent,
    HelpComponent,
    PeerTubeTemplateDirective,
    FormsModule,
    RouterLink,
    SelectChannelComponent,
    SelectOptionsComponent,
    ReactiveFormsModule,
    VideoEditComponent,
    ButtonComponent,
    AlertComponent
  ]
})
export class VideoImportUrlComponent extends VideoSend implements OnInit, AfterViewInit, CanComponentDeactivate {
  @ViewChild('videoEdit', { static: false }) videoEditComponent: VideoEditComponent

  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()

  targetUrl = ''

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false

  video: VideoEdit
  error: string

  constructor (
    protected formReactiveService: FormReactiveService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    protected videoChapterService: VideoChapterService,
    private router: Router,
    private videoImportService: VideoImportService,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-url-import.init', 'video-edit')
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  isTargetUrlValid () {
    return this.targetUrl?.match(/https?:\/\//)
  }

  isChannelSyncEnabled () {
    return this.serverConfig.import.videoChannelSynchronization.enabled
  }

  importVideo () {
    this.isImportingVideo = true

    const videoUpdate: VideoUpdate = {
      privacy: this.highestPrivacy,
      waitTranscoding: false,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.useRef().start()

    this.videoImportService
        .importVideoUrl(this.targetUrl, videoUpdate)
        .pipe(
          switchMap(previous => {
            return forkJoin([
              this.videoCaptionService.listCaptions(previous.video.uuid),
              this.videoChapterService.getChapters({ videoId: previous.video.uuid }),
              this.videoService.getVideo({ videoId: previous.video.uuid })
            ]).pipe(map(([ videoCaptionsResult, { chapters }, video ]) => ({ videoCaptions: videoCaptionsResult.data, chapters, video })))
          })
        )
        .subscribe({
          next: ({ video, videoCaptions, chapters }) => {
            this.loadingBar.useRef().complete()
            this.firstStepDone.emit(video.name)
            this.isImportingVideo = false
            this.hasImportedVideo = true

            this.video = new VideoEdit(video)
            this.video.patch({ privacy: this.firstStepPrivacyId })

            this.chaptersEdit.loadFromAPI(chapters)

            this.videoCaptions = videoCaptions

            hydrateFormFromVideo(this.form, this.video, true)
            setTimeout(() => this.videoEditComponent.patchChapters(this.chaptersEdit))
          },

          error: err => {
            this.loadingBar.useRef().complete()
            this.isImportingVideo = false
            this.firstStepError.emit()
            this.notifier.error(err.message)
          }
        })
  }

  async updateSecondStep () {
    if (!await this.isFormValid()) return

    this.video.patch(this.form.value)
    this.chaptersEdit.patch(this.form.value)

    this.isUpdatingVideo = true

    // Update the video
    this.updateVideoAndCaptionsAndChapters({ video: this.video, captions: this.videoCaptions, chapters: this.chaptersEdit })
        .subscribe({
          next: () => {
            this.isUpdatingVideo = false
            this.notifier.success($localize`Video to import updated.`)

            this.router.navigate([ '/my-library', 'video-imports' ])
          },

          error: err => {
            this.error = err.message
            scrollToTop()
            logger.error(err)
          }
        })
  }
}
