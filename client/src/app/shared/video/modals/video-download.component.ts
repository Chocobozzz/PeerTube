import { Component, ElementRef, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AuthService, Notifier } from '@app/core'
import { VideoPrivacy, VideoCaption } from '@shared/models'

type DownloadType = 'video' | 'subtitles'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  downloadType: 'direct' | 'torrent' = 'torrent'
  resolutionId: number | string = -1
  subtitleLanguageId: string

  video: VideoDetails
  videoCaptions: VideoCaption[]
  activeModal: NgbActiveModal

  type: DownloadType = 'video'

  constructor (
    private notifier: Notifier,
    private modalService: NgbModal,
    private auth: AuthService,
    private i18n: I18n
  ) { }

  get typeText () {
    return this.type === 'video'
      ? this.i18n('video')
      : this.i18n('subtitles')
  }

  getVideoFiles () {
    if (!this.video) return []

    return this.video.getFiles()
  }

  show (video: VideoDetails, videoCaptions?: VideoCaption[]) {
    this.video = video
    this.videoCaptions = videoCaptions && videoCaptions.length ? videoCaptions : undefined

    this.activeModal = this.modalService.open(this.modal, { centered: true })

    this.resolutionId = this.getVideoFiles()[0].resolution.id
    if (this.videoCaptions) this.subtitleLanguageId = this.videoCaptions[0].language.id
  }

  onClose () {
    this.video = undefined
    this.videoCaptions = undefined
  }

  download () {
    window.location.assign(this.getLink())
    this.activeModal.close()
  }

  getLink () {
    return this.type === 'subtitles' && this.videoCaptions
      ? this.getSubtitlesLink()
      : this.getVideoLink()
  }

  getVideoLink () {
    // HTML select send us a string, so convert it to a number
    this.resolutionId = parseInt(this.resolutionId.toString(), 10)

    const file = this.getVideoFiles().find(f => f.resolution.id === this.resolutionId)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return
    }

    const suffix = this.video.privacy.id === VideoPrivacy.PRIVATE || this.video.privacy.id === VideoPrivacy.INTERNAL
      ? '?access_token=' + this.auth.getAccessToken()
      : ''

    switch (this.downloadType) {
      case 'direct':
        return file.fileDownloadUrl + suffix

      case 'torrent':
        return file.torrentDownloadUrl + suffix
    }
  }

  getSubtitlesLink () {
    return window.location.origin + this.videoCaptions.find(caption => caption.language.id === this.subtitleLanguageId).captionPath
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Copied'))
  }

  switchToType (type: DownloadType) {
    this.type = type
  }
}
