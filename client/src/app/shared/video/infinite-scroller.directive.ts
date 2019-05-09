import { distinct, distinctUntilChanged, filter, map, share, startWith, throttleTime } from 'rxjs/operators'
import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { fromEvent, Subscription } from 'rxjs'

@Directive({
  selector: '[myInfiniteScroller]'
})
export class InfiniteScrollerDirective implements OnInit, OnDestroy {
  @Input() percentLimit = 70
  @Input() autoInit = false
  @Input() onItself = false

  @Output() nearOfBottom = new EventEmitter<void>()

  private decimalLimit = 0
  private lastCurrentBottom = -1
  private scrollDownSub: Subscription
  private container: HTMLElement

  constructor (private el: ElementRef) {
    this.decimalLimit = this.percentLimit / 100
  }

  ngOnInit () {
    if (this.autoInit === true) return this.initialize()
  }

  ngOnDestroy () {
    if (this.scrollDownSub) this.scrollDownSub.unsubscribe()
  }

  initialize () {
    if (this.onItself) {
      this.container = this.el.nativeElement
    }

    // Emit the last value
    const throttleOptions = { leading: true, trailing: true }

    const scrollObservable = fromEvent(this.container || window, 'scroll')
      .pipe(
        startWith(null),
        throttleTime(200, undefined, throttleOptions),
        map(() => this.getScrollInfo()),
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
  }

  private getScrollInfo () {
    if (this.container) {
      return { current: this.container.scrollTop, maximumScroll: this.container.scrollHeight }
    }

    return { current: window.scrollY, maximumScroll: document.body.clientHeight - window.innerHeight }
  }
}
