import { Component, OnInit, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import {
  AuthService,
  ComponentPagination,
  ConfirmService,
  DisableForReuseHook,
  Notifier,
  updatePaginationOnDelete,
  User,
  UserService
} from '@app/core'
import { immutableAssign } from '@app/helpers'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { UserHistoryService } from '@app/shared/shared-main/users/user-history.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature/video-miniature.component'
import { VideosSelectionComponent } from '@app/shared/shared-video-miniature/videos-selection.component'
import { tap } from 'rxjs/operators'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { InputSwitchComponent } from '../../shared/shared-forms/input-switch.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { PeerTubeTemplateDirective } from '../../shared/shared-main/common/peertube-template.directive'

@Component({
  templateUrl: './my-history.component.html',
  styleUrls: [ './my-history.component.scss' ],
  standalone: true,
  imports: [
    ButtonComponent,
    AdvancedInputFilterComponent,
    InputSwitchComponent,
    FormsModule,
    VideosSelectionComponent,
    PeerTubeTemplateDirective,
    DeleteButtonComponent
  ]
})
export class MyHistoryComponent implements OnInit, DisableForReuseHook {
  @ViewChild('videosSelection', { static: true }) videosSelection: VideosSelectionComponent

  titlePage: string
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

  videosHistoryEnabled: boolean

  miniatureDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    privacyLabel: false,
    privacyText: true,
    state: true,
    blacklistInfo: true
  }

  getVideosObservableFunction = this.getVideosObservable.bind(this)

  user: User

  videos: Video[] = []
  search: string

  disabled = false

  constructor (
    private authService: AuthService,
    private userService: UserService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private userHistoryService: UserHistoryService
  ) {
    this.titlePage = $localize`My watch history`
  }

  ngOnInit () {
    this.user = this.authService.getUser()

    this.authService.userInformationLoaded
      .subscribe(() => this.videosHistoryEnabled = this.user.videosHistoryEnabled)
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  reloadData () {
    this.videosSelection.reloadVideos()
  }

  onSearch (search: string) {
    this.search = search
    this.reloadData()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.userHistoryService.list(newPagination, this.search)
      .pipe(
        tap(res => this.pagination.totalItems = res.total)
      )
  }

  generateSyndicationList () {
    /* method disabled */
    throw new Error('Method not implemented.')
  }

  onVideosHistoryChange () {
    this.userService.updateMyProfile({ videosHistoryEnabled: this.videosHistoryEnabled })
      .subscribe({
        next: () => {
          const message = this.videosHistoryEnabled === true
            ? $localize`Video history is enabled`
            : $localize`Video history is disabled`

          this.notifier.success(message)

          this.authService.refreshUserInformation()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  deleteHistoryElement (video: Video) {
    this.userHistoryService.deleteElement(video)
      .subscribe({
        next: () => {
          this.videos = this.videos.filter(v => v.id !== video.id)
          updatePaginationOnDelete(this.pagination)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  async clearAllHistory () {
    const title = $localize`Delete video history`
    const message = $localize`Are you sure you want to delete all your video history?`

    const res = await this.confirmService.confirm(message, title)
    if (res !== true) return

    this.userHistoryService.clearAll()
        .subscribe({
          next: () => {
            this.notifier.success($localize`Video history deleted`)

            this.reloadData()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  getNoResultMessage () {
    if (this.search) {
      return $localize`No videos found for "${this.search}".`
    }

    return $localize`You don't have any video in your watch history yet.`
  }
}
