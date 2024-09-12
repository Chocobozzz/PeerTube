import { fromEvent, Subscription } from 'rxjs'
import { distinctUntilChanged, filter, map, share, startWith, throttleTime } from 'rxjs/operators'
import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { PeerTubeRouterService, RouterSetting } from '@app/core'
import { I18nSelectPipe, NgIf } from '@angular/common'
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router'

@Component({
  selector: 'my-infinite-scroller',
  standalone: true,
  templateUrl: './infinite-scroller.component.html',
  styleUrl: './infinite-scroller.component.scss',
  imports: [
    NgIf,
    RouterLink,
    I18nSelectPipe
  ]
})
export class InfiniteScrollerComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() hasMore: boolean
  @Input() isLoading: boolean
  @Input() percentLimit = 70
  @Input() onItself = false

  // Add angular state in query params to reuse the routed component
  @Input() setAngularState: boolean
  @Input() parentDisabled = false

  @Output() nearOfBottom = new EventEmitter<void>()

  @Input() currentPage!: number
  @Output() currentPageChange = new EventEmitter<number>()

  private disabled: boolean

  private decimalLimit = 0
  private lastCurrentBottom = -1
  private scrollDownSub: Subscription
  private container: HTMLElement

  private routeEventSub: Subscription

  constructor (
    private peertubeRouter: PeerTubeRouterService,
    private el: ElementRef,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.decimalLimit = this.percentLimit / 100
  }

  ngAfterViewChecked () {
    if (this.hasMore && !this.isLoading) {
      // Wait HTML update
      setTimeout(() => {
        if (this.hasScroll() === false && !this.disabled) this.nearOfBottom.emit()
      })
    }
  }

  ngOnInit () {
    this.disabled = !!this.route.snapshot.queryParams.page

    this.changePage(+this.route.snapshot.queryParams['page'] || 1)

    this.routeEventSub = this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        const search = event.url.split('?')[1]
        const params = new URLSearchParams(search)
        const newPage = +params.get('page') || 1

        if (newPage === this.currentPage) return

        this.changePage(newPage)
      })

    this.initialize()
  }

  ngOnDestroy () {
    if (this.scrollDownSub) this.scrollDownSub.unsubscribe()
    if (this.routeEventSub) this.routeEventSub.unsubscribe()
  }

  initialize () {
    this.container = this.onItself
      ? this.el.nativeElement
      : document.documentElement

    // Emit the last value
    const throttleOptions = { leading: true, trailing: true }

    const scrollableElement = this.onItself ? this.container : window
    const scrollObservable = fromEvent(scrollableElement, 'scroll')
      .pipe(
        startWith(true),
        throttleTime(200, undefined, throttleOptions),
        map(() => this.getScrollInfo()),
        distinctUntilChanged((o1, o2) => o1.current === o2.current),
        share()
      )

    // Scroll Down
    this.scrollDownSub = scrollObservable
      .pipe(
        filter(({ current }) => this.isScrollingDown(current)),
        filter(({ current, maximumScroll }) => (current / maximumScroll) > this.decimalLimit)
      )
      .subscribe(() => {
        if (this.setAngularState && !this.parentDisabled) this.setScrollRouteParams()

        if (!this.disabled) this.nearOfBottom.emit()
      })
  }

  private changePage (newPage: number) {
    this.currentPage = newPage
    this.currentPageChange.emit(newPage)
  }

  private getScrollInfo () {
    return { current: this.container.scrollTop, maximumScroll: this.getMaximumScroll() }
  }

  private getMaximumScroll () {
    const elementHeight = this.onItself ? this.container.clientHeight : window.innerHeight

    return this.container.scrollHeight - elementHeight
  }

  private hasScroll () {
    return this.getMaximumScroll() > 0
  }

  private isScrollingDown (current: number) {
    const result = this.lastCurrentBottom < current

    this.lastCurrentBottom = current
    return result
  }

  private setScrollRouteParams () {
    this.peertubeRouter.addRouteSetting(RouterSetting.REUSE_COMPONENT)
  }
}
