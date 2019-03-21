import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { UserHistoryService } from '@app/shared/users/user-history.service'
import { UserService } from '@app/shared'
import { Notifier, ServerService } from '@app/core'

@Component({
  selector: 'my-account-history',
  templateUrl: './my-account-history.component.html',
  styleUrls: [ './my-account-history.component.scss' ]
})
export class MyAccountHistoryComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }
  videosHistoryEnabled: boolean

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected userService: UserService,
    protected notifier: Notifier,
    protected screenService: ScreenService,
    protected i18n: I18n,
    private confirmService: ConfirmService,
    private videoService: VideoService,
    private userHistoryService: UserHistoryService
  ) {
    super()

    this.titlePage = this.i18n('My videos history')
  }

  ngOnInit () {
    super.ngOnInit()

    this.videosHistoryEnabled = this.authService.getUser().videosHistoryEnabled
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.userHistoryService.getUserVideosHistory(newPagination)
  }

  generateSyndicationList () {
    throw new Error('Method not implemented.')
  }

  onVideosHistoryChange () {
    this.userService.updateMyProfile({ videosHistoryEnabled: this.videosHistoryEnabled })
      .subscribe(
        () => {
          const message = this.videosHistoryEnabled === true ?
            this.i18n('Videos history is enabled') :
            this.i18n('Videos history is disabled')

          this.notifier.success(message)

          this.authService.refreshUserInformation()
        },

        err => this.notifier.error(err.message)
      )
  }

  async deleteHistory () {
    const title = this.i18n('Delete videos history')
    const message = this.i18n('Are you sure you want to delete all your videos history?')

    const res = await this.confirmService.confirm(message, title)
    if (res !== true) return

    this.userHistoryService.deleteUserVideosHistory()
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Videos history deleted'))

            this.reloadVideos()
          },

          err => this.notifier.error(err.message)
        )
  }
}
