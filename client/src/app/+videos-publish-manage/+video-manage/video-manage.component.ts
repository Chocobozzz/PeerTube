import { CommonModule } from '@angular/common'
import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { VideoEdit } from '../shared-manage/common/video-edit.model'
import { VideoManageContainerComponent } from '../shared-manage/video-manage-container.component'
import { VideoManageController } from '../shared-manage/video-manage-controller.service'
import { VideoManageResolverData } from './video-manage.resolver'

@Component({
  selector: 'my-video-manage',
  templateUrl: './video-manage.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    VideoManageContainerComponent
  ],
  providers: [ VideoManageController ]
})
export class VideoManageComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private route = inject(ActivatedRoute)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)

  private manageController = inject(VideoManageController)

  isUpdatingVideo = false
  loaded = false

  async ngOnInit () {
    const data = this.route.snapshot.data.resolverData as VideoManageResolverData
    const { video, userChannels, captions, chapters, videoSource, live, videoPasswords, userQuota, privacies } = data

    const videoEdit = await VideoEdit.createFromAPI(this.serverService.getHTMLConfig(), {
      video,
      captions,
      chapters,
      live,
      videoSource,
      videoPasswords: videoPasswords.map(p => p.password)
    })

    this.manageController.setStore({
      videoEdit,
      userQuota,
      userChannels,
      privacies
    })

    this.manageController.setConfig({ manageType: 'update', serverConfig: this.serverService.getHTMLConfig() })

    this.loaded = true
  }

  ngOnDestroy () {
    this.manageController.cancelUploadIfNeeded()
  }

  onVideoUpdated () {
    this.notifier.success($localize`Video updated.`)
  }

  @HostListener('window:beforeunload', [ '$event' ])
  onUnload (event: any) {
    const { text, canDeactivate } = this.canDeactivate()

    if (canDeactivate) return

    event.returnValue = text
    return text
  }

  canDeactivate (): { canDeactivate: boolean, text?: string } {
    return {
      canDeactivate: !this.manageController.hasPendingChanges(),
      text: $localize`You have unsaved changes. Are you sure you want to leave?`
    }
  }
}
