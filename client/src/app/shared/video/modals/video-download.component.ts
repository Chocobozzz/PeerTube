import { Component, ElementRef, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AuthService, Notifier } from '@app/core'
import { VideoPrivacy } from '@shared/models'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  downloadType: 'direct' | 'torrent' = 'torrent'
  resolutionId: number | string = -1

  video: VideoDetails
  activeModal: NgbActiveModal

  constructor (
    private notifier: Notifier,
    private modalService: NgbModal,
    private auth: AuthService,
    private i18n: I18n
  ) { }

  getVideoFiles () {
    if (!this.video) return []

    return this.video.getFiles()
  }

  show (video: VideoDetails) {
    this.video = video

    this.activeModal = this.modalService.open(this.modal)

    this.resolutionId = this.getVideoFiles()[0].resolution.id
  }

  onClose () {
    this.video = undefined
  }

  download () {
    window.location.assign(this.getLink())
    this.activeModal.close()
  }

  getLink () {
    // HTML select send us a string, so convert it to a number
    this.resolutionId = parseInt(this.resolutionId.toString(), 10)

    const file = this.getVideoFiles().find(f => f.resolution.id === this.resolutionId)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return
    }

    const suffix = this.video.privacy.id === VideoPrivacy.PRIVATE
      ? '?access_token=' + this.auth.getAccessToken()
      : ''

    switch (this.downloadType) {
      case 'direct':
        return file.fileDownloadUrl + suffix

      case 'torrent':
        return file.torrentDownloadUrl + suffix
    }
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Copied'))
  }
}
