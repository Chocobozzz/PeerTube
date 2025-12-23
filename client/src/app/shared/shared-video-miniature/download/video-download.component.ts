import { NgClass, NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, inject, input, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, HooksService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption, VideoSource } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { videoRequiresFileToken } from '@root-helpers/video'
import { of } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { VideoDetails } from '../../shared-main/video/video-details.model'
import { VideoFileTokenService } from '../../shared-main/video/video-file-token.service'
import { VideoService } from '../../shared-main/video/video.service'
import { SubtitleFilesDownloadComponent } from './subtitle-files-download.component'
import { VideoFilesDownloadComponent } from './video-files-download.component'
import { VideoGenerateDownloadComponent } from './video-generate-download.component'

type DownloadType = 'video-generate' | 'video-files' | 'subtitle-files'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ],
  imports: [
    SubtitleFilesDownloadComponent,
    VideoFilesDownloadComponent,
    VideoGenerateDownloadComponent,
    GlobalIconComponent,
    FormsModule,
    NgClass,
    NgTemplateOutlet
  ]
})
export class VideoDownloadComponent {
  private modalService = inject(NgbModal)
  private authService = inject(AuthService)
  private videoService = inject(VideoService)
  private videoFileTokenService = inject(VideoFileTokenService)
  private hooks = inject(HooksService)

  readonly modal = viewChild<ElementRef>('modal')

  readonly videoPassword = input<string>(undefined)

  video: VideoDetails
  type: DownloadType = 'video-generate'

  videoFileToken: string
  originalVideoFile: VideoSource

  loaded = false

  private videoCaptions: VideoCaption[]
  private activeModal: NgbModalRef

  getCaptions () {
    if (!this.videoCaptions) return []

    return this.videoCaptions
  }

  show (video: VideoDetails, videoCaptions?: VideoCaption[]) {
    this.loaded = false

    this.videoFileToken = undefined
    this.originalVideoFile = undefined

    this.video = video
    this.videoCaptions = videoCaptions

    this.activeModal = this.modalService.open(this.modal(), { centered: true })

    this.getOriginalVideoFileObs()
      .subscribe(source => {
        if (source?.fileDownloadUrl) {
          this.originalVideoFile = source
        }

        if (this.originalVideoFile || videoRequiresFileToken(this.video)) {
          this.videoFileTokenService.getVideoFileToken({ videoUUID: this.video.uuid, videoPassword: this.videoPassword() })
            .subscribe(({ token }) => {
              this.videoFileToken = token

              this.loaded = true
            })
        } else {
          this.loaded = true
        }
      })

    this.activeModal.shown.subscribe(() => {
      this.hooks.runAction('action:modal.video-download.shown', 'common')
    })
  }

  private getOriginalVideoFileObs () {
    if (!this.video.isLocal || !this.authService.isLoggedIn()) return of(undefined)

    const user = this.authService.getUser()
    if (!this.video.isOwnerOrHasSeeAllVideosRight(user)) return of(undefined)

    return this.videoService.getSource(this.video.id)
      .pipe(catchError(err => {
        logger.error('Cannot get source file', err)

        return of(undefined)
      }))
  }

  // ---------------------------------------------------------------------------

  onDownloaded () {
    this.activeModal.close()
  }

  hasCaptions () {
    return this.getCaptions().length !== 0
  }
}
