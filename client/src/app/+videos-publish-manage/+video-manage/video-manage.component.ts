import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { VideoManageContainerComponent } from '../shared-manage/video-manage-container.component'
import { VideoManageController } from '../shared-manage/video-manage-controller.service'
import { VideoManageResolverData } from './video-manage.resolver'

@Component({
  selector: 'my-video-manage',
  templateUrl: './video-manage.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    VideoManageContainerComponent
  ]
})
export class VideoManageComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private route = inject(ActivatedRoute)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)

  private manageController = inject(VideoManageController)

  ngOnInit () {
    const data = this.route.snapshot.data.resolverData as VideoManageResolverData
    const { userChannels, userQuota, privacies, videoEdit } = data

    this.manageController.setStore({
      videoEdit,
      userQuota,
      userChannels,
      privacies
    })

    this.manageController.setConfig({ manageType: 'update', serverConfig: this.serverService.getHTMLConfig() })
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
