import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ComponentPagination, hasMoreItems, Notifier, resetCurrentPage } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { InfiniteScrollerDirective } from '@app/shared/shared-main/common/infinite-scroller.directive'
import { VideoChannelActivity } from '@peertube/peertube-models'
import { Subject, Subscription } from 'rxjs'
import { VideoChannelEditControllerService } from '../video-channel-edit-controller.service'
import { VideoChannelEdit } from '../video-channel-edit.model'
import { VideoChannelActivityComponent } from './video-channel-activity.component'
import { DateGroupLabelComponent } from '@app/shared/shared-main/date/date-group-label.component'

@Component({
  selector: 'my-video-channel-activities',
  templateUrl: './video-channel-activities.component.html',
  styleUrls: [ './video-channel-activities.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    GlobalIconComponent,
    InfiniteScrollerDirective,
    VideoChannelActivityComponent,
    DateGroupLabelComponent
  ]
})
export class VideoChannelActivitiesComponent implements OnInit, OnDestroy {
  private notifier = inject(Notifier)
  private channelService = inject(VideoChannelService)
  private editController = inject(VideoChannelEditControllerService)

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: null
  }

  videoChannelEdit: VideoChannelEdit

  activities: VideoChannelActivity[] = []

  onDataSubject = new Subject<any[]>()

  groupByDateStore = new Set<number>()

  private storeSub: Subscription

  ngOnInit () {
    this.videoChannelEdit = this.editController.getStore()
    this.reload()

    this.storeSub = this.editController.getStoreChangesObs()
      .subscribe(() => {
        this.videoChannelEdit = this.editController.getStore()

        this.reload()
      })
  }

  ngOnDestroy () {
    this.storeSub?.unsubscribe()
  }

  private reload () {
    this.activities = []
    resetCurrentPage(this.pagination)

    this.loadMoreActivities()
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMoreActivities()
  }

  private loadMoreActivities () {
    this.channelService.listActivities({
      channelName: this.videoChannelEdit.channel.name,
      componentPagination: this.pagination
    }).subscribe({
      next: res => {
        this.activities = this.activities.concat(res.data)
        this.pagination.totalItems = res.total

        this.onDataSubject.next(res.data)
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
