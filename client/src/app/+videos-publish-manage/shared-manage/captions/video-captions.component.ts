
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { VideoCaptionEdit, VideoCaptionWithPathEdit } from '@app/+videos-publish-manage/shared-manage/common/video-caption-edit.model'
import { ServerService } from '@app/core'
import { removeElementFromArray } from '@app/helpers'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { HTMLServerConfig, VideoConstant } from '@peertube/peertube-models'
import debug from 'debug'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../../shared/shared-main/buttons/edit-button.component'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoCaptionEditModalComponent } from './video-caption-edit-modal.component'

const debugLogger = debug('peertube:video-manage')

@Component({
  selector: 'my-video-captions',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-captions.component.scss'
  ],
  templateUrl: './video-captions.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    GlobalIconComponent,
    DeleteButtonComponent,
    VideoCaptionAddModalComponent,
    PTDatePipe,
    EditButtonComponent,
    ButtonComponent,
    AlertComponent,
    VideoCaptionEditModalComponent
]
})
export class VideoCaptionsComponent implements OnInit {
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)

  readonly videoCaptionAddModal = viewChild<VideoCaptionAddModalComponent>('videoCaptionAddModal')
  readonly videoCaptionEditModal = viewChild<VideoCaptionEditModalComponent>('videoCaptionEditModal')

  serverConfig: HTMLServerConfig

  displayTranscriptionInfo: boolean
  videoEdit: VideoEdit

  videoLanguages: VideoConstant<string>[] = []

  private initialVideoCaptions: string[] = []

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const { displayTranscriptionInfo } = this.manageController.getConfig()
    this.displayTranscriptionInfo = displayTranscriptionInfo

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit

    this.initialVideoCaptions = this.videoEdit.getCaptionsEdit().map(c => c.language.id)
  }

  // ---------------------------------------------------------------------------

  getCaptionLabel (caption: VideoCaptionWithPathEdit) {
    if (caption.automaticallyGenerated) {
      return $localize`${caption.language.label} (auto-generated)`
    }

    return caption.language.label
  }

  getExistingCaptions () {
    return this.videoEdit
      .getCaptionsEdit()
      .filter(c => c.action !== 'REMOVE')
      .map(c => c.language.id)
  }

  onCaptionEdited (caption: VideoCaptionEdit) {
    const captionsEdit = this.videoEdit.getCaptionsEdit()

    const existingCaption = captionsEdit
      .find(c => c.language.id === caption.language.id)

    // Replace existing caption
    if (existingCaption) {
      Object.assign(existingCaption, caption)
    } else {
      captionsEdit.push(
        Object.assign(caption, { action: 'CREATE' as 'CREATE' })
      )
    }

    this.sortVideoCaptions()

    debugLogger('Caption edited', caption)
  }

  deleteCaption (caption: VideoCaptionEdit) {
    // Caption recovers his former state
    if (caption.action && this.initialVideoCaptions.includes(caption.language.id)) {
      caption.action = undefined
      return
    }

    // This caption is not on the server, just remove it from our array
    if (caption.action === 'CREATE' || caption.action === 'UPDATE') {
      removeElementFromArray(this.videoEdit.getCaptionsEdit(), caption)
      return
    }

    caption.action = 'REMOVE' as 'REMOVE'

    debugLogger('Caption deleted', caption)
  }

  openAddCaptionModal () {
    this.videoCaptionAddModal().show()
  }

  openEditCaptionModal (videoCaption: VideoCaptionWithPathEdit) {
    this.videoCaptionEditModal().show({
      videoCaption,
      serverConfig: this.serverConfig,
      videoEdit: this.videoEdit,
      captionEdited: caption => this.onCaptionEdited(caption)
    })
  }

  isTranscriptionEnabled () {
    return this.serverConfig.videoTranscription.enabled
  }

  hasCaptions () {
    return this.getExistingCaptions().length !== 0
  }

  private sortVideoCaptions () {
    this.videoEdit.getCaptionsEdit().sort((v1, v2) => {
      if (v1.language.label < v2.language.label) return -1
      if (v1.language.label === v2.language.label) return 0

      return 1
    })
  }

  isLive () {
    return this.videoEdit.getVideoAttributes().isLive
  }
}
