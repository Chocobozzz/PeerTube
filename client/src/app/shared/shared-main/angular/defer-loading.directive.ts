import debug from 'debug'
import {
  AfterViewInit,
  ChangeDetectorRef,
  ContentChild,
  Directive,
  ElementRef,
  EmbeddedViewRef,
  EventEmitter,
  OnDestroy,
  Output,
  TemplateRef,
  ViewContainerRef
} from '@angular/core'

const debugLogger = debug('peertube:main:DeferLoadingDirective')

@Directive({
  selector: '[myDeferLoading]',
  standalone: true
})
export class DeferLoadingDirective implements AfterViewInit, OnDestroy {
  @ContentChild(TemplateRef) template: TemplateRef<any>

  @Output() loaded = new EventEmitter()

  view: EmbeddedViewRef<any>

  private observer: IntersectionObserver

  constructor (
    private el: ElementRef,
    private viewContainer: ViewContainerRef,
    private cd: ChangeDetectorRef
  ) { }

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
    this.view = this.viewContainer.createEmbeddedView(this.template, {}, 0)
    this.loaded.emit()
    this.cd.detectChanges()
  }

  isLoaded () {
    return this.view != null
  }

  ngOnDestroy () {
    this.view = null

    if (this.observer) this.observer.disconnect()
  }

  private hasIncompatibleBrowser () {
    return !('IntersectionObserver' in window)
  }
}
