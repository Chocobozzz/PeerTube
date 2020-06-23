import { distinctUntilChanged, filter, map, share, startWith, throttleTime } from 'rxjs/operators'
import { AfterContentChecked, Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { fromEvent, Observable, Subscription } from 'rxjs'

@Directive({
  selector: '[myInfiniteScroller]'
})
export class InfiniteScrollerDirective implements OnInit, OnDestroy, AfterContentChecked {
  @Input() percentLimit = 70
  @Input() autoInit = false
  @Input() onItself = false
  @Input() dataObservable: Observable<any[]>

  @Output() nearOfBottom = new EventEmitter<void>()

  private decimalLimit = 0
  private lastCurrentBottom = -1
  private scrollDownSub: Subscription
  private container: HTMLElement

  private checkScroll = false

  constructor (private el: ElementRef) {
    this.decimalLimit = this.percentLimit / 100
  }

  ngAfterContentChecked () {
    if (this.checkScroll) {
      this.checkScroll = false

      console.log('Checking if the initial state has a scroll.')

      if (this.hasScroll() === false) this.nearOfBottom.emit()
    }
  }

  ngOnInit () {
    if (this.autoInit === true) return this.initialize()
  }

  ngOnDestroy () {
    if (this.scrollDownSub) this.scrollDownSub.unsubscribe()
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
      .subscribe(() => this.nearOfBottom.emit())

    if (this.dataObservable) {
      this.dataObservable
          .pipe(filter(d => d.length !== 0))
          .subscribe(() => this.checkScroll = true)
    }
  }

  private getScrollInfo () {
    return { current: this.container.scrollTop, maximumScroll: this.getMaximumScroll() }
  }

  private getMaximumScroll () {
    return this.container.scrollHeight - window.innerHeight
  }

  private hasScroll () {
    return this.getMaximumScroll() > 0
  }

  private isScrollingDown (current: number) {
    const result = this.lastCurrentBottom < current

    this.lastCurrentBottom = current
    return result
  }
}
