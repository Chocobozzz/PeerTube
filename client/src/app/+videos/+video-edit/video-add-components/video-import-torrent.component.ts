import { switchMap } from 'rxjs'
import { AfterViewInit, Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoChapterService, VideoEdit, VideoImportService, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { logger } from '@root-helpers/logger'
import { PeerTubeProblemDocument, ServerErrorCode, VideoUpdate } from '@peertube/peertube-models'
import { hydrateFormFromVideo } from '../shared/video-edit-utils'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-import-torrent',
  templateUrl: './video-import-torrent.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-import-torrent.component.scss',
    './video-send.scss'
  ]
})
export class VideoImportTorrentComponent extends VideoSend implements OnInit, AfterViewInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  @ViewChild('torrentfileInput') torrentfileInput: ElementRef<HTMLInputElement>

  magnetUri = ''

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
    this.hooks.runAction('action:video-torrent-import.init', 'video-edit')
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  isMagnetUrlValid () {
    return !!this.magnetUri
  }

  fileChange () {
    const torrentfile = this.torrentfileInput.nativeElement.files[0]
    if (!torrentfile) return

    this.importVideo(torrentfile)
  }

  setTorrentFile (files: FileList) {
    this.torrentfileInput.nativeElement.files = files
    this.fileChange()
  }

  importVideo (torrentfile?: Blob) {
    this.isImportingVideo = true

    const videoUpdate: VideoUpdate = {
      privacy: this.highestPrivacy,
      waitTranscoding: false,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.useRef().start()

    this.videoImportService.importVideoTorrent(torrentfile || this.magnetUri, videoUpdate)
      .pipe(switchMap(({ video }) => this.videoService.getVideo({ videoId: video.uuid })))
      .subscribe({
        next: video => {
          this.loadingBar.useRef().complete()
          this.firstStepDone.emit(video.name)
          this.isImportingVideo = false
          this.hasImportedVideo = true

          this.video = new VideoEdit(video)
          this.video.patch({ privacy: this.firstStepPrivacyId })

          hydrateFormFromVideo(this.form, this.video, false)
        },

        error: err => {
          this.loadingBar.useRef().complete()
          this.isImportingVideo = false
          this.firstStepError.emit()

          let message = err.message

          const error = err.body as PeerTubeProblemDocument
          if (error?.code === ServerErrorCode.INCORRECT_FILES_IN_TORRENT) {
            message = $localize`Torrents with only 1 file are supported.`
          }

          this.notifier.error(message)
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
