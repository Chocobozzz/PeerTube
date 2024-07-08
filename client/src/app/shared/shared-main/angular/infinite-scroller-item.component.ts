import { AfterViewChecked, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core'
import { InfiniteScrollerComponent } from './infinite-scroller.component'

export type InfiniteScrollerItem<T> = T & {
  page: number
}

@Component({
  selector: 'my-infinite-scroller-item',
  templateUrl: './infinite-scroller-item.component.html',
  imports: [],
  standalone: true
})
export class InfiniteScrollerItemComponent implements AfterViewChecked, OnDestroy {
    @Input() id: number | string
    @Input() page: number
    @Input() observer: IntersectionObserver

    @ViewChild('el') el: ElementRef

    private isObserving = false

    constructor (parent: InfiniteScrollerComponent) {
      this.observer = parent.itemsObserver
    }

    ngAfterViewChecked () {
      if (!this.isObserving && this.observer) {
        this.observer.observe(this.el.nativeElement)
        this.isObserving = true
      }
    }

    ngOnDestroy () {
      this.observer?.unobserve(this.el.nativeElement)
    }
}
