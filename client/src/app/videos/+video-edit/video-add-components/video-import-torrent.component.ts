import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { VideoPrivacy, VideoUpdate } from '../../../../../../shared/models/videos'
import { AuthService, Notifier, ServerService } from '../../../core'
import { VideoService } from '../../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoSend } from '@app/videos/+video-edit/video-add-components/video-send'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { VideoEdit } from '@app/shared/video/video-edit.model'
import { FormValidatorService } from '@app/shared'
import { VideoCaptionService } from '@app/shared/video-caption'
import { VideoImportService } from '@app/shared/video-import'
import { scrollToTop } from '@app/shared/misc/utils'

@Component({
  selector: 'my-video-import-torrent',
  templateUrl: './video-import-torrent.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-import-torrent.component.scss',
    './video-send.scss'
  ]
})
export class VideoImportTorrentComponent extends VideoSend implements OnInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  @ViewChild('torrentfileInput') torrentfileInput: ElementRef<HTMLInputElement>

  magnetUri = ''

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false

  video: VideoEdit
  error: string

  protected readonly DEFAULT_VIDEO_PRIVACY = VideoPrivacy.PUBLIC

  constructor (
    protected formValidatorService: FormValidatorService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private router: Router,
    private videoImportService: VideoImportService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
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
      privacy: this.firstStepPrivacyId,
      waitTranscoding: false,
      commentsEnabled: true,
      downloadEnabled: true,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.start()

    this.videoImportService.importVideoTorrent(torrentfile || this.magnetUri, videoUpdate).subscribe(
      res => {
        this.loadingBar.complete()
        this.firstStepDone.emit(res.video.name)
        this.isImportingVideo = false
        this.hasImportedVideo = true

        this.video = new VideoEdit(Object.assign(res.video, {
          commentsEnabled: videoUpdate.commentsEnabled,
          downloadEnabled: videoUpdate.downloadEnabled,
          support: null,
          thumbnailUrl: null,
          previewUrl: null
        }))

        this.hydrateFormFromVideo()
      },

      err => {
        this.loadingBar.complete()
        this.isImportingVideo = false
        this.firstStepError.emit()
        this.notifier.error(err.message)
      }
    )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    this.video.patch(this.form.value)

    this.isUpdatingVideo = true

    // Update the video
    this.updateVideoAndCaptions(this.video)
        .subscribe(
          () => {
            this.isUpdatingVideo = false
            this.notifier.success(this.i18n('Video to import updated.'))

            this.router.navigate([ '/my-account', 'video-imports' ])
          },

          err => {
            this.error = err.message
            scrollToTop()
            console.error(err)
          }
        )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toFormPatch())
  }
}
