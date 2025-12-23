
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { VideoEdit } from '@app/+videos-publish-manage/shared-manage/common/video-edit.model'
import { VideoUploadService } from '@app/+videos-publish-manage/shared-manage/common/video-upload.service'
import { VideoManageController } from '@app/+videos-publish-manage/shared-manage/video-manage-controller.service'
import { AuthService, CanComponentDeactivate, HooksService, MetaService, Notifier, ServerService } from '@app/core'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserVideoQuota, VideoPrivacyType } from '@peertube/peertube-models'
import debug from 'debug'
import { truncate } from 'lodash-es'
import { Subscription } from 'rxjs'
import { SelectChannelItem } from 'src/types'
import { PreviewUploadComponent } from '../../../shared/shared-forms/preview-upload.component'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { VideoManageContainerComponent } from '../../shared-manage/video-manage-container.component'
import { DragDropDirective } from '../shared/drag-drop.directive'

const debugLogger = debug('peertube:video-publish')

@Component({
  selector: 'my-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: [
    '../shared/common-publish.scss',
    './video-upload.component.scss'
  ],
  imports: [
    DragDropDirective,
    GlobalIconComponent,
    NgbTooltip,
    SelectChannelComponent,
    FormsModule,
    PreviewUploadComponent,
    ButtonComponent,
    ReactiveFormsModule,
    VideoManageContainerComponent
]
})
export class VideoUploadComponent implements OnInit, OnDestroy, AfterViewInit, CanComponentDeactivate {
  private notifier = inject(Notifier)
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private hooks = inject(HooksService)
  private metaService = inject(MetaService)
  private route = inject(ActivatedRoute)
  private videoUploadService = inject(VideoUploadService)
  private manageController = inject(VideoManageController)

  readonly userChannels = input.required<SelectChannelItem[]>()
  readonly userQuota = input.required<UserVideoQuota>()
  readonly highestPrivacy = input.required<VideoPrivacyType>()

  readonly firstStepDone = output<string>()
  readonly firstStepError = output()
  readonly videoFileInput = viewChild<ElementRef<HTMLInputElement>>('videoFileInput')

  uploadingAudioFile = false
  audioPreviewFile: File

  firstStep = true
  firstStepChannelId: number

  hasFirstUpdated = false

  private videoEdit: VideoEdit
  private uploadEventsSubscription: Subscription

  ngOnInit () {
    this.uploadEventsSubscription = this.manageController.getUploadEventsObs()
      .subscribe(state => {
        this.updateTitle()

        if (state.status === 'cancelled') {
          debugLogger('Upload cancelled', state)

          this.firstStepError.emit()
          this.firstStep = true
          this.manageController.silentRedirectOnAbortUpload(this.route)

          return
        }

        if (state.status === 'complete') {
          const { id, uuid, shortUUID } = state.response.video

          this.videoEdit.loadAfterPublish({ video: { id, uuid, shortUUID } })

          debugLogger(`Upload complete`, state)

          this.manageController.silentRedirectOnManage(shortUUID, this.route)
          return
        }
      })

    this.firstStepChannelId = this.userChannels()[0].id
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-upload.init', 'video-edit')
  }

  ngOnDestroy () {
    this.uploadEventsSubscription?.unsubscribe()
    this.manageController.cancelUploadIfNeeded()
  }

  canDeactivate () {
    if (this.firstStep) return { canDeactivate: true }

    let text = ''

    if (this.hasUploadedFile() !== true) {
      text = $localize`Your video is not uploaded yet, are you sure you want to leave this page?`
    } else if (this.manageController.hasPendingChanges()) {
      text = $localize`Your video was uploaded to your library. But there are unsaved changes: are you sure you want to leave this page?`
    }

    return { canDeactivate: !text, text }
  }

  updateTitle () {
    if (this.hasUploadedFile()) {
      this.metaService.setTitle($localize`Publish`)
    } else if (this.uploadingAudioFile || !this.firstStep) {
      this.metaService.setTitle(`${this.manageController.getUploadPercents()}% - Publish`)
    } else {
      this.metaService.update(this.route.snapshot.data['meta'])
    }
  }

  getVideoExtensions () {
    return this.videoUploadService.getVideoExtensions().join(', ')
  }

  onFileDropped (files: FileList) {
    const videoFileInput = this.videoFileInput()
    videoFileInput.nativeElement.files = files

    this.onFileChange({ target: videoFileInput.nativeElement })
  }

  onFileChange (event: Event | { target: HTMLInputElement }) {
    this.resetUploadState()

    const file = (event.target as HTMLInputElement).files[0]
    if (!file) return

    if (!this.manageController.checkUserQuota(file)) return

    if (this.videoUploadService.isAudioFile(file.name)) {
      this.uploadingAudioFile = true
      return
    }

    this.firstStep = false

    this.uploadFile(file)
  }

  private resetUploadState () {
    this.firstStep = true
    this.videoEdit = undefined
    this.uploadingAudioFile = false
    this.audioPreviewFile = undefined
  }

  uploadAudio () {
    this.uploadFile(this.getInputVideoFile(), this.audioPreviewFile)
  }

  getAudioUploadLabel () {
    const videoFile = this.getInputVideoFile()
    if (!videoFile) return $localize`Upload`

    return $localize`Upload ${videoFile.name}`
  }

  onVideoUpdated () {
    this.notifier.success($localize`Changes saved.`)
  }

  hasUploadedFile () {
    if (!this.videoEdit) return false

    return !!this.videoEdit.getVideoAttributes().id
  }

  getCancelLink () {
    if (this.hasUploadedFile()) {
      return '/my-library/videos'
    }

    return '/videos/publish'
  }

  reset () {
    this.resetUploadState()
    this.manageController.cancelUploadIfNeeded()
    this.updateTitle()
  }

  private getInputVideoFile () {
    return this.videoFileInput().nativeElement.files[0]
  }

  private uploadFile (file: File, previewfile?: File) {
    const serverConfig = this.serverService.getHTMLConfig()

    this.videoEdit = VideoEdit.createFromUpload(serverConfig, {
      name: this.buildVideoFilename(file.name),
      channelId: this.firstStepChannelId,
      support: this.userChannels().find(c => c.id === this.firstStepChannelId).support ?? '',
      user: this.authService.getUser()
    })

    this.manageController.setConfig({ manageType: 'upload', serverConfig: this.serverService.getHTMLConfig() })
    this.manageController.setVideoEdit(this.videoEdit)
    this.manageController.uploadNewVideo({ privacy: this.highestPrivacy(), file, previewfile })
    this.manageController.silentRedirectOnUploading(this.route)

    this.firstStep = false
    this.firstStepDone.emit(this.videoEdit.getVideoAttributes().name)

    this.updateTitle()
  }

  private buildVideoFilename (filename: string) {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '')
    let name = nameWithoutExtension.length < 3
      ? filename
      : nameWithoutExtension

    const videoNameMaxSize = 110
    if (name.length > videoNameMaxSize) {
      name = truncate(name, { length: videoNameMaxSize, omission: '' })
    }

    return name
  }
}
