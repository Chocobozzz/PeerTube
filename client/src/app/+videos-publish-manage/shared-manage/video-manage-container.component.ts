import { HttpErrorResponse } from '@angular/common/http'
import { booleanAttribute, Component, inject, input, OnDestroy, OnInit, output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { Notifier, ScreenService } from '@app/core'
import { HeaderService } from '@app/header/header.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoStateMessageService } from '@app/shared/shared-video/video-state-message.service'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { UploadProgressComponent } from '../../shared/shared-upload/upload-progress.component'
import { ManageErrorsComponent } from './common/manage-errors.component'
import { VideoEdit } from './common/video-edit.model'
import { VideoManageController } from './video-manage-controller.service'
import { VideoManageMenuComponent } from './video-manage-menu.component'

@Component({
  selector: 'my-video-manage-container',
  styleUrls: [ './video-manage-container.component.scss' ],
  templateUrl: './video-manage-container.component.html',
  imports: [
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonComponent,
    ManageErrorsComponent,
    NgbTooltipModule,
    UploadProgressComponent,
    VideoManageMenuComponent
  ]
})
export class VideoManageContainerComponent implements OnInit, OnDestroy {
  private manageController = inject(VideoManageController)
  private notifier = inject(Notifier)
  private headerService = inject(HeaderService)
  private screenService = inject(ScreenService)
  private videoStateMessage = inject(VideoStateMessageService)

  readonly canWatch = input.required<boolean, string | boolean>({ transform: booleanAttribute })
  readonly canUpdate = input.required<boolean, string | boolean>({ transform: booleanAttribute })

  readonly uploadedLabel = input<string>()
  readonly cancelLink = input<string>()

  readonly videoUpdated = output()

  displayFormErrorsMsg = false

  canRetryUpload = true

  isUpdating = false

  private videoEdit: VideoEdit

  ngOnInit (): void {
    if (this.screenService.isInMobileView()) {
      this.headerService.setSearchHidden(true)
    }

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit
  }

  ngOnDestroy (): void {
    this.headerService.setSearchHidden(false)
  }

  // ---------------------------------------------------------------------------

  hasFormErrors () {
    return this.manageController.hasFormErrors()
  }

  // ---------------------------------------------------------------------------

  getStateWarning () {
    const video = this.videoEdit.getVideoAttributes()

    return this.videoStateMessage.buildWarn(video.id, video.state)
  }

  // ---------------------------------------------------------------------------

  hasPendingChanges () {
    return this.manageController.hasPendingChanges()
  }

  hasReplaceFile () {
    return this.manageController.hasReplaceFile()
  }

  hasStudioTasks () {
    return this.manageController.hasStudioTasks()
  }

  // ---------------------------------------------------------------------------

  async onWantToUpdate () {
    this.displayFormErrorsMsg = false

    await this.manageController.runSaveHook()

    if (this.hasFormErrors()) {
      this.displayFormErrorsMsg = true
      return
    }

    if (this.isUpdating) return
    this.isUpdating = true

    if (
      !await this.manageController.checkAndConfirmVideoFileReplacement() ||
      !await this.manageController.checkAndConfirmStudioTasks()
    ) {
      this.isUpdating = false
      return
    }

    this.manageController.updateVideo()
      .subscribe({
        next: () => {
          this.isUpdating = false

          return this.videoUpdated.emit()
        },

        error: (err: HttpErrorResponse) => {
          this.isUpdating = false

          this.notifier.error(err.message)
        }
      })
  }

  getUploadPercents () {
    return this.manageController.getUploadPercents()
  }

  getUploadError () {
    return this.manageController.getUploadError()
  }

  isUploadingFile () {
    return this.manageController.isUploadingFile()
  }

  hasUploadedFile () {
    return this.manageController.hasUploadedFile()
  }

  getWatchUrl () {
    return Video.buildWatchUrl(this.videoEdit.getVideoAttributes())
  }

  getVideo () {
    return this.videoEdit.getVideoAttributes()
  }

  retryUpload () {
    this.canRetryUpload = false

    this.manageController.cancelUploadIfNeeded()
    this.manageController.retryUpload()
  }
}
