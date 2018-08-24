import { distinct, distinctUntilChanged, filter, map, share, startWith, throttleTime } from 'rxjs/operators'
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { fromEvent, Subscription } from 'rxjs'

@Directive({
  selector: '[myInfiniteScroller]'
})
export class InfiniteScrollerDirective implements OnInit, OnDestroy {
  private static PAGE_VIEW_TOP_MARGIN = 500

  @Input() containerHeight: number
  @Input() pageHeight: number
  @Input() percentLimit = 70
  @Input() autoInit = false

  @Output() nearOfBottom = new EventEmitter<void>()
  @Output() nearOfTop = new EventEmitter<void>()
  @Output() pageChanged = new EventEmitter<number>()

  private decimalLimit = 0
  private lastCurrentBottom = -1
  private lastCurrentTop = 0
  private scrollDownSub: Subscription
  private scrollUpSub: Subscription
  private pageChangeSub: Subscription

  constructor () {
    this.decimalLimit = this.percentLimit / 100
  }

  ngOnInit () {
    if (this.autoInit === true) return this.initialize()
  }

  ngOnDestroy () {
    if (this.scrollDownSub) this.scrollDownSub.unsubscribe()
    if (this.scrollUpSub) this.scrollUpSub.unsubscribe()
    if (this.pageChangeSub) this.pageChangeSub.unsubscribe()
  }

  initialize () {
    // Emit the last value
    const throttleOptions = { leading: true, trailing: true }

    const scrollObservable = fromEvent(window, 'scroll')
      .pipe(
        startWith(null),
        throttleTime(200, undefined, throttleOptions),
        map(() => ({ current: window.scrollY, maximumScroll: document.body.clientHeight - window.innerHeight })),
        distinctUntilChanged((o1, o2) => o1.current === o2.current),
        share()
      )

    // Scroll Down
    this.scrollDownSub = scrollObservable
      .pipe(
        // Check we scroll down
        filter(({ current }) => {
          const res = this.lastCurrentBottom < current

          this.lastCurrentBottom = current
          return res
        }),
        filter(({ current, maximumScroll }) => maximumScroll <= 0 || (current / maximumScroll) > this.decimalLimit)
      )
      .subscribe(() => this.nearOfBottom.emit())

    // Scroll up
    this.scrollUpSub = scrollObservable
      .pipe(
        // Check we scroll up
        filter(({ current }) => {
          const res = this.lastCurrentTop > current

          this.lastCurrentTop = current
          return res
        }),
        filter(({ current, maximumScroll }) => {
          return current !== 0 && (1 - (current / maximumScroll)) > this.decimalLimit
        })
      )
      .subscribe(() => this.nearOfTop.emit())

    // Page change
    this.pageChangeSub = scrollObservable
      .pipe(
        distinct(),
        map(({ current }) => this.calculateCurrentPage(current)),
        distinctUntilChanged()
      )
      .subscribe(res => this.pageChanged.emit(res))
  }

  private calculateCurrentPage (current: number) {
    return Math.max(1, Math.round((current + InfiniteScrollerDirective.PAGE_VIEW_TOP_MARGIN) / this.pageHeight))
  }
}
