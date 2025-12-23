import { CommonModule } from '@angular/common'
import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { DisableForReuseHook, Notifier, PeerTubeRouterService, ServerService, User, UserService } from '@app/core'
import { ActorAvatarComponent, ActorAvatarInput } from '@app/shared/shared-actor-image/actor-avatar.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { InfiniteScrollerDirective } from '@app/shared/shared-main/common/infinite-scroller.directive'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoMiniatureComponent } from '@app/shared/shared-video-miniature/video-miniature.component'
import { Subject, Subscription, switchMap } from 'rxjs'
import { OverviewService } from './overview.service'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ],
  imports: [
    InfiniteScrollerDirective,
    RouterLink,
    VideoMiniatureComponent,
    ButtonComponent,
    CommonModule,
    ActorAvatarComponent
  ]
})
export class VideoOverviewComponent implements OnInit, OnDestroy, AfterViewChecked, DisableForReuseHook {
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private overviewService = inject(OverviewService)
  private cd = inject(ChangeDetectorRef)
  private server = inject(ServerService)
  private peertubeRouter = inject(PeerTubeRouterService)

  readonly quickAccessContent = viewChild<ElementRef>('quickAccessContent')

  onDataSubject = new Subject<any>()

  notResults = false

  userMiniature: User

  objects: {
    label: string

    type: string
    buttonLabel: string
    videos: Video[]

    channel?: ActorAvatarInput

    queryParams: Record<string, any>
    routerLink: string[]
  }[] = []

  quickAccessLinks: typeof this.objects = []
  seeAllQuickLinks = false
  quickAccessOverflow = false

  disabled = false

  private loaded = false
  private currentPage = 1
  private maxPage = 20
  private lastWasEmpty = false
  private isLoading = false
  private checkQuickAccessOverflow = false

  private userSub: Subscription

  ngOnInit () {
    this.loadMoreResults()

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.userMiniature = user)

    this.userSub = this.userService.listenAnonymousUpdate()
      .pipe(switchMap(() => this.userService.getAnonymousOrLoggedUser()))
      .subscribe(user => {
        this.userMiniature = user

        this.objects = []
        this.loadMoreResults()
      })
  }

  ngOnDestroy () {
    if (this.userSub) this.userSub.unsubscribe()
  }

  ngAfterViewChecked () {
    if (this.quickAccessOverflow) return
    if (!this.checkQuickAccessOverflow) return

    this.checkQuickAccessOverflow = false

    const el = this.quickAccessContent().nativeElement as HTMLElement
    this.quickAccessOverflow = el.scrollWidth > el.clientWidth
    this.cd.detectChanges()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  onNearOfBottom () {
    if (this.currentPage >= this.maxPage) return
    if (this.lastWasEmpty) return
    if (this.isLoading) return
    if (this.disabled) return

    if (window.location.pathname === '/') {
      this.peertubeRouter.silentNavigate([], {})
    }

    this.currentPage++
    this.loadMoreResults()
  }

  private loadMoreResults () {
    this.isLoading = true

    this.overviewService.getVideosOverview(this.currentPage)
      .subscribe({
        next: overview => {
          this.isLoading = false

          if (overview.tags.length === 0 && overview.channels.length === 0 && overview.categories.length === 0) {
            this.lastWasEmpty = true
            if (this.loaded === false) this.notResults = true

            return
          }

          this.loaded = true
          this.onDataSubject.next(overview)

          for (const value of overview.categories) {
            this.objects.push({
              buttonLabel: $localize`Browse "${value.category.label}" videos`,
              label: value.category.label,
              routerLink: [ '/search' ],
              queryParams: { categoryOneOf: [ value.category.id ] },
              videos: value.videos,
              type: $localize`category`
            })
          }

          for (const value of overview.tags) {
            this.objects.push({
              buttonLabel: $localize`Browse "#${value.tag}" videos`,
              label: `#${value.tag}`,
              routerLink: [ '/search' ],
              queryParams: { tagsOneOf: [ value.tag ] },
              videos: value.videos,
              type: $localize`tag`
            })
          }

          for (const value of overview.channels) {
            const channelName = this.server.getHTMLConfig().client.videos.miniature.preferAuthorDisplayName
              ? value.videos[0].channel.displayName
              : value.videos[0].byVideoChannel

            this.objects.push({
              buttonLabel: $localize`Browse ${channelName} channel`,
              label: channelName,
              routerLink: [ '/c', value.videos[0].byVideoChannel ],
              queryParams: {},
              videos: value.videos,
              channel: value.channel,
              type: $localize`channel`
            })
          }

          this.quickAccessLinks = this.objects.map(o => o)
          this.checkQuickAccessOverflow = true
        },

        error: err => {
          this.notifier.handleError(err)
          this.isLoading = false
        }
      })
  }
}
