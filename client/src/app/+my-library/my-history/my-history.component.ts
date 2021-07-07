import { Subject } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Component, ComponentFactoryResolver, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  ConfirmService,
  DisableForReuseHook,
  LocalStorageService,
  Notifier,
  ScreenService,
  ServerService,
  User,
  UserService
} from '@app/core'
import { immutableAssign } from '@app/helpers'
import { UserHistoryService, Video } from '@app/shared/shared-main'
import { MiniatureDisplayOptions, VideosSelectionComponent } from '@app/shared/shared-video-miniature'

@Component({
  templateUrl: './my-history.component.html',
  styleUrls: [ './my-history.component.scss' ]
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

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected userService: UserService,
    protected notifier: Notifier,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    private confirmService: ConfirmService,
    private userHistoryService: UserHistoryService,
    protected cfr: ComponentFactoryResolver
  ) {
    this.titlePage = $localize`My watch history`
  }

  ngOnInit () {
    this.user = this.authService.getUser()

    this.authService.userInformationLoaded
      .subscribe(() => this.videosHistoryEnabled = this.user.videosHistoryEnabled)
  }

  disableForReuse () {
    this.videosSelection.disableForReuse()
  }

  enabledForReuse () {
    this.videosSelection.enabledForReuse()
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

    return this.userHistoryService.getUserVideosHistory(newPagination, this.search)
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
      .subscribe(
        () => {
          const message = this.videosHistoryEnabled === true ?
            $localize`Videos history is enabled` :
            $localize`Videos history is disabled`

          this.notifier.success(message)

          this.authService.refreshUserInformation()
        },

        err => this.notifier.error(err.message)
      )
  }

  async deleteHistory () {
    const title = $localize`Delete videos history`
    const message = $localize`Are you sure you want to delete all your videos history?`

    const res = await this.confirmService.confirm(message, title)
    if (res !== true) return

    this.userHistoryService.deleteUserVideosHistory()
        .subscribe(
          () => {
            this.notifier.success($localize`Videos history deleted`)

            this.reloadData()
          },

          err => this.notifier.error(err.message)
        )
  }
}
