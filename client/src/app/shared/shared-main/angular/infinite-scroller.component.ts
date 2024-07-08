import { Observable, Subscription } from 'rxjs'
import {
  AfterContentInit,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChild
} from '@angular/core'
import { PeerTubeRouterService, RouterSetting } from '@app/core'
import { LoadMoreComponent } from './load-more.component'
import { NgIf } from '@angular/common'
import { InfiniteScrollerItemComponent } from './infinite-scroller-item.component'
import { ActivatedRoute, Router } from '@angular/router'

interface PageData {
  ratio: number
  id: string
}

const sumRatio = (pageData: PageData[]) => pageData.reduce((acc: number, val) => acc + val.ratio, 0)

@Component({
  selector: 'my-infinite-scroller',
  templateUrl: './infinite-scroller.component.html',
  imports: [
    NgIf,
    LoadMoreComponent
  ],
  standalone: true
})
export class InfiniteScrollerComponent implements OnInit, OnDestroy, AfterContentInit {
  @Input() percentLimit = 70 // Not needed anymore
  @Input() onItself = false
  @Input() dataObservable: Observable<any[]> // Not needed anymore
  @Input() hasMore = false
  @Input() isLoading = false

  // Add angular state in query params to reuse the routed component
  @Input() setAngularState: boolean
  @Input() parentDisabled = false

  @Output() nearOfBottom = new EventEmitter<number>()
  @Output() nearOfTop = new EventEmitter<number>()

  @ContentChildren(InfiniteScrollerItemComponent) items: QueryList<InfiniteScrollerItemComponent>
  @ViewChild('loadNext') loadNextEl: ElementRef
  @ViewChild('loadPrevious') loadPreviousEl: ElementRef

  hasLoadedFirstPage: boolean = null
  itemsObserver: IntersectionObserver

  private currentPage: number
  private container: HTMLElement
  private lastContainerInfo: { domRect: DOMRect, scrollTop: number }

  private isLoadingPrevious = false
  private contentChildrenChanges: Subscription
  private loadedPageNumbers: number[] = []

  constructor (
    private peertubeRouter: PeerTubeRouterService,
    private el: ElementRef,
    private changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit () {
    let visibleItems: { [key: string]: PageData[] } = {}

    this.itemsObserver = new IntersectionObserver((entries) => {
      visibleItems = entries.reduce((acc, val) => {
        const pageNumber = val.target.getAttribute('data-page-number')
        const id = val.target.getAttribute('data-id')
        const recordsForPageNumber = (acc[pageNumber] || []).filter(r => r.id !== id)

        if (!this.loadedPageNumbers.includes(+pageNumber)) {
          this.loadedPageNumbers = [ ...this.loadedPageNumbers, +pageNumber ].sort((a, b) => a - b)
        }

        if (val.isIntersecting) {
          return { ...acc, [pageNumber]: [ ...recordsForPageNumber, { id, ratio: val.intersectionRatio } ] }
        } else {
          return { ...acc, [pageNumber]: recordsForPageNumber }
        }
      }, { ...visibleItems })

      const [ mostIntersectedPage ] = Object.keys(visibleItems)
        .sort((a, b) => sumRatio(visibleItems[b]) - sumRatio(visibleItems[a]))

      if (this.currentPage === +mostIntersectedPage) {
        return
      }

      this.currentPage = +mostIntersectedPage

      if (!this.hasLoadedFirstPage) {
        this.hasLoadedFirstPage = this.currentPage === 1
      }

      this.peertubeRouter.silentNavigate([], { page: this.currentPage + '' })
    })

    this.container = this.onItself
      ? this.el.nativeElement
      : document.documentElement
  }

  ngAfterContentInit () {
    this.listenForDetach()

    this.contentChildrenChanges = this.items.changes.subscribe(_ => {
      // Avoid jumping UX upon loading previous
      if (!this.isLoadingPrevious) return

      this.changeDetectionRef.detectChanges() // Trigger render

      const { scrollTop: lastScrollTop, domRect: { height: lastHeight } } = this.lastContainerInfo

      const top = lastScrollTop + this.container.getBoundingClientRect().height - lastHeight
      window.scrollTo({
        top,
        behavior: 'instant'
      })

      this.isLoadingPrevious = false
    })
  }

  ngOnDestroy () {
    this.unsubscribeListeners()
  }

  onDetach () {
    this.unsubscribeListeners()
  }

  onLoadPrevious () {
    if (this.isLoading) return
    console.log('onLoadMore')

    this.isLoadingPrevious = true
    this.lastContainerInfo = {
      domRect: this.container.getBoundingClientRect(),
      scrollTop: this.container.scrollTop
    }

    this.nearOfTop.emit(this.loadedPageNumbers[0] - 1)

    if (this.setAngularState && !this.parentDisabled) this.setScrollRouteParams()
  }

  onLoadMore () {
    if (this.isLoading) return
    console.log('onLoadMore')

    this.nearOfBottom.emit(this.loadedPageNumbers[this.loadedPageNumbers.length - 1] + 1)

    if (this.setAngularState && !this.parentDisabled) this.setScrollRouteParams()
  }

  private unsubscribeListeners () {
    if (this.itemsObserver) this.itemsObserver.disconnect()
    if (this.contentChildrenChanges) this.contentChildrenChanges.unsubscribe()
  }

  private listenForDetach () {
    const originalPath = this.route.snapshot.url.map(u => u.path).join('/')

    const navEndEvents = this.peertubeRouter.getNavigationEndEvents()
      .subscribe((event) => {
        const urlTree = this.router.parseUrl(event.url)
        urlTree.queryParams = {}

        if (urlTree.toString() !== originalPath) {
          this.onDetach()
          navEndEvents.unsubscribe()
        }
      })
  }

  private setScrollRouteParams () {
    this.peertubeRouter.addRouteSetting(RouterSetting.REUSE_COMPONENT)
  }
}
