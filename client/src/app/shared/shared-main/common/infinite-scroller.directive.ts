import { AfterViewChecked, booleanAttribute, Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core'
import { fromEvent, Observable, Subscription } from 'rxjs'
import { distinctUntilChanged, filter, map, share, startWith, throttleTime } from 'rxjs/operators'

@Directive({
  selector: '[myInfiniteScroller]',
  standalone: true
})
export class InfiniteScrollerDirective implements OnInit, OnDestroy, AfterViewChecked {
  private el = inject(ElementRef)

  readonly percentLimit = input(70)
  readonly onItself = input(false, { transform: booleanAttribute })
  readonly dataObservable = input<Observable<any[]>>(undefined)

  readonly nearOfBottom = output()

  private decimalLimit = 0
  private lastCurrentBottom: number
  private scrollDownSub: Subscription
  private container: HTMLElement

  private checkScroll = false

  constructor () {
    this.decimalLimit = this.percentLimit() / 100
  }

  ngAfterViewChecked () {
    if (this.checkScroll) {
      this.checkScroll = false

      // Wait HTML update
      setTimeout(() => {
        if (this.hasScroll() === false) this.nearOfBottom.emit()
      })
    }
  }

  ngOnInit () {
    this.initialize()
  }

  ngOnDestroy () {
    if (this.scrollDownSub) this.scrollDownSub.unsubscribe()
  }

  initialize () {
    this.container = this.onItself()
      ? this.el.nativeElement
      : document.documentElement

    // Emit the last value
    const throttleOptions = { leading: true, trailing: true }

    const scrollableElement = this.onItself() ? this.container : window
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
        this.nearOfBottom.emit()
      })

    const dataObservable = this.dataObservable()
    if (dataObservable) {
      dataObservable
        .pipe(filter(d => d.length !== 0))
        .subscribe(() => this.checkScroll = true)
    }
  }

  private getScrollInfo () {
    return { current: this.container.scrollTop, maximumScroll: this.getMaximumScroll() }
  }

  private getMaximumScroll () {
    const elementHeight = this.onItself() ? this.container.clientHeight : window.innerHeight

    return this.container.scrollHeight - elementHeight
  }

  private hasScroll () {
    return this.getMaximumScroll() > 0
  }

  private isScrollingDown (current: number) {
    if (this.lastCurrentBottom === undefined) {
      this.lastCurrentBottom = current
      return false
    }

    const result = this.lastCurrentBottom < current

    this.lastCurrentBottom = current
    return result
  }
}
