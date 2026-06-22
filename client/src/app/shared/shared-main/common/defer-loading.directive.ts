import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EmbeddedViewRef,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  contentChild,
  inject,
  output
} from '@angular/core'
import debug from 'debug'

const debugLogger = debug('peertube:main:DeferLoadingDirective')

@Directive({
  selector: '[myDeferLoading]',
  standalone: true
})
export class DeferLoadingDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef)
  private viewContainer = inject(ViewContainerRef)
  private cd = inject(ChangeDetectorRef)

  readonly template = contentChild(TemplateRef)

  readonly loaded = output()

  view: EmbeddedViewRef<any>

  private observer: IntersectionObserver

  ngAfterViewInit () {
    if (this.hasIncompatibleBrowser()) {
      return this.load()
    }

    this.observer = new IntersectionObserver(entries => {
      const entry = entries[0]
      if (!entry.isIntersecting || entry.target !== this.el.nativeElement) return

      this.observer.unobserve(this.el.nativeElement)
      this.load()
    }, { threshold: 0.1 })

    this.observer.observe(this.el.nativeElement)
  }

  load () {
    if (this.isLoaded()) return

    debugLogger('Loading component')

    this.viewContainer.clear()
    this.view = this.viewContainer.createEmbeddedView(this.template(), {}, 0)
    this.loaded.emit()
    this.cd.detectChanges()
  }

  isLoaded () {
    return this.view !== null && this.view !== undefined
  }

  ngOnDestroy () {
    this.view = null

    if (this.observer) this.observer.disconnect()
  }

  private hasIncompatibleBrowser () {
    return !('IntersectionObserver' in window)
  }
}
