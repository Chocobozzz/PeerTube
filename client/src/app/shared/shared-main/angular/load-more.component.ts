import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core'

@Component({
  selector: 'my-load-more',
  // styleUrls: [ './link.component.scss' ],
  templateUrl: './load-more.component.html',
  standalone: true,
  imports: []
})
export class LoadMoreComponent implements AfterViewInit, OnDestroy {
    @Output() isVisible = new EventEmitter<void>()

    @ViewChild('el') elem: ElementRef

    observer: IntersectionObserver

    ngAfterViewInit () {
      this.observer = new IntersectionObserver((entries) => {
        const isVisible = entries.find(e => e.isIntersecting)

        if (isVisible) {
          this.isVisible.emit()
        }
      })

      this.observer.observe(this.elem.nativeElement)
    }

    ngOnDestroy () {
      this.observer.disconnect()
    }
}
