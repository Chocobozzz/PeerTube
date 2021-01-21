import { Component, ComponentFactoryResolver, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  ConfirmService,
  LocalStorageService,
  Notifier,
  ScreenService,
  ServerService,
  UserService
} from '@app/core'
import { immutableAssign } from '@app/helpers'
import { UserHistoryService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { Subject } from 'rxjs'
import { debounceTime, tap, distinctUntilChanged } from 'rxjs/operators'

@Component({
  templateUrl: './my-history.component.html',
  styleUrls: [ './my-history.component.scss' ]
})
export class MyHistoryComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }
  videosHistoryEnabled: boolean
  search: string

  protected searchStream: Subject<string>

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
    super()

    this.titlePage = $localize`My watch history`
  }

  ngOnInit () {
    super.ngOnInit()

    this.authService.userInformationLoaded
      .subscribe(() => {
        this.videosHistoryEnabled = this.authService.getUser().videosHistoryEnabled
      })

    this.searchStream = new Subject()

    this.searchStream
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(search => {
        this.search = search
        this.reloadVideos()
      })
  }

  onSearch (event: Event) {
    const target = event.target as HTMLInputElement
    this.searchStream.next(target.value)
  }

  resetSearch () {
    const searchInput = document.getElementById('history-search') as HTMLInputElement
    searchInput.value = ''
    this.searchStream.next('')
  }

  ngOnDestroy () {
    super.ngOnDestroy()
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

            this.reloadVideos()
          },

          err => this.notifier.error(err.message)
        )
  }
}
