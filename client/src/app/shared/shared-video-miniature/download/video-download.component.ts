import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, HooksService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption, VideoSource } from '@peertube/peertube-models'
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
  standalone: true,
  imports: [
    SubtitleFilesDownloadComponent,
    VideoFilesDownloadComponent,
    VideoGenerateDownloadComponent,
    GlobalIconComponent,
    NgIf,
    FormsModule,
    NgClass,
    NgTemplateOutlet
  ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Input() videoPassword: string

  video: VideoDetails
  type: DownloadType = 'video-generate'

  videoFileToken: string
  originalVideoFile: VideoSource

  loaded = false

  private videoCaptions: VideoCaption[]
  private activeModal: NgbModalRef

  constructor (
    private modalService: NgbModal,
    private authService: AuthService,
    private videoService: VideoService,
    private videoFileTokenService: VideoFileTokenService,
    private hooks: HooksService
  ) {}

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

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    this.getOriginalVideoFileObs()
      .subscribe(source => {
        if (source?.fileDownloadUrl) {
          this.originalVideoFile = source
        }

        if (this.originalVideoFile || videoRequiresFileToken(this.video)) {
          this.videoFileTokenService.getVideoFileToken({ videoUUID: this.video.uuid, videoPassword: this.videoPassword })
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
        console.error('Cannot get source file', err)

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
