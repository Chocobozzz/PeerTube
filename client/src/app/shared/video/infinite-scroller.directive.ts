import { Directive, EventEmitter, Input, OnInit, Output } from '@angular/core'
import 'rxjs/add/operator/debounceTime'
import 'rxjs/add/operator/distinct'
import 'rxjs/add/operator/distinctUntilChanged'
import 'rxjs/add/operator/filter'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/startWith'
import 'rxjs/add/operator/throttleTime'
import { fromEvent } from 'rxjs/observable/fromEvent'
import 'rxjs/add/operator/share'

@Directive({
  selector: '[myInfiniteScroller]'
})
export class InfiniteScrollerDirective implements OnInit {
  private static PAGE_VIEW_TOP_MARGIN = 500

  @Input() containerHeight: number
  @Input() pageHeight: number
  @Input() percentLimit = 70
  @Input() autoLoading = false

  @Output() nearOfBottom = new EventEmitter<void>()
  @Output() nearOfTop = new EventEmitter<void>()
  @Output() pageChanged = new EventEmitter<number>()

  private decimalLimit = 0
  private lastCurrentBottom = -1
  private lastCurrentTop = 0

  constructor () {
    this.decimalLimit = this.percentLimit / 100
  }

  ngOnInit () {
    if (this.autoLoading === true) return this.initialize()
  }

  initialize () {
    // Emit the last value
    const throttleOptions = { leading: false, trailing: true }

    const scrollObservable = fromEvent(window, 'scroll')
      .startWith(true)
      .throttleTime(200, undefined, throttleOptions)
      .map(() => ({ current: window.scrollY, maximumScroll: document.body.clientHeight - window.innerHeight }))
      .share()

    // Scroll Down
    scrollObservable
      // Check we scroll down
      .filter(({ current }) => {
        const res = this.lastCurrentBottom < current

        this.lastCurrentBottom = current
        return res
      })
      .filter(({ current, maximumScroll }) => maximumScroll <= 0 || (current / maximumScroll) > this.decimalLimit)
      .subscribe(() => this.nearOfBottom.emit())

    // Scroll up
    scrollObservable
      // Check we scroll up
      .filter(({ current }) => {
        const res = this.lastCurrentTop > current

        this.lastCurrentTop = current
        return res
      })
      .filter(({ current, maximumScroll }) => {
        return current !== 0 && (1 - (current / maximumScroll)) > this.decimalLimit
      })
      .subscribe(() => this.nearOfTop.emit())

    // Page change
    scrollObservable
      .distinct()
      .map(({ current }) => this.calculateCurrentPage(current))
      .distinctUntilChanged()
      .subscribe(res => this.pageChanged.emit(res))
  }

  private calculateCurrentPage (current: number) {
    return Math.max(1, Math.round((current + InfiniteScrollerDirective.PAGE_VIEW_TOP_MARGIN) / this.pageHeight))
  }
}
