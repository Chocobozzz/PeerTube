import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, forwardRef, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Subject, Observable, Subscription, fromEvent } from 'rxjs'
import truncate from 'lodash-es/truncate'
import { ScreenService } from '@app/shared/misc/screen.service'
import { MarkdownService } from '@app/shared/renderer'

@Component({
  selector: 'my-markdown-textarea',
  templateUrl: './markdown-textarea.component.html',
  styleUrls: [ './markdown-textarea.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownTextareaComponent),
      multi: true
    }
  ]
})

export class MarkdownTextareaComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() content = ''
  @Input() classes: string[] | { [klass: string]: any[] | any } = []
  @Input() textareaMaxWidth = '100%'
  @Input() textareaHeight = '150px'
  @Input() truncate: number
  @Input() markdownType: 'text' | 'enhanced' = 'text'
  @Input() markdownVideo = false
  @Input() name = 'description'

  @ViewChild('textarea') textareaElement: ElementRef

  truncatedPreviewHTML = ''
  previewHTML = ''
  isMaximized = false

  private contentChanged = new Subject<string>()
  private resizeObserver: Observable<Event> | any
  private resizeSubscription: Subscription
  private orientationChangeObserver: Observable<Event>
  private orientationChangeSubscription: Subscription

  constructor (
    private screenService: ScreenService,
    private markdownService: MarkdownService
) {}

  ngOnInit () {
    this.contentChanged
        .pipe(
          debounceTime(150),
          distinctUntilChanged()
        )
        .subscribe(() => this.updatePreviews())

    this.contentChanged.next(this.content)
  }

  ngOnDestroy () {
    this.unobserveBodyResize()
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (description: string) {
    this.content = description

    this.contentChanged.next(this.content)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.content)

    this.contentChanged.next(this.content)
  }

  onMaximizeClick () {
    this.isMaximized = !this.isMaximized

    // Make sure textarea have the focus
    this.textareaElement.nativeElement.focus()

    // Make sure the window has no scrollbars
    if (!this.isMaximized) {
      this.unobserveBodyResize()
      this.unlockBodyScroll()
    } else {
      this.observeBodyResize()
      this.lockBodyScroll()
    }
  }

  arePreviewsDisplayed () {
    // Unused
    return this.screenService.isInSmallView() === false
  }

  private lockBodyScroll () {
    const contentElement = document.getElementById('content')

    contentElement
      .firstElementChild
      .lastElementChild
      .classList.add('fixed')
  }

  private unlockBodyScroll () {
    const contentElement = document.getElementById('content')

    contentElement
      .firstElementChild
      .lastElementChild
      .classList.remove('fixed')
  }

  private observeBodyResize () {
    // Make sure the window has scrollbars if resized to a small view and exit maximized mode
    // By observing resize event
    if (typeof window.ResizeObserver === 'function') {
      // Use window.ResizeObserver while ResizeObserver not implemented in TypeScript
      this.resizeObserver = new window.ResizeObserver(() => this.onBodyResize())
      this.resizeObserver.observe(document.body)
    } else {
      this.resizeObserver = fromEvent(window, 'resize')
      this.resizeSubscription = this.resizeObserver.subscribe(() => this.onBodyResize())
    }

    // Make sure the window has scrollbars if orientation change to a small view and exit maximized mode
    // By observing orientationchange event
    this.orientationChangeObserver = fromEvent(window, 'onrientationchange')
    this.orientationChangeSubscription = this.orientationChangeObserver.subscribe(() => this.onBodyResize())
  }

  private unobserveBodyResize () {
    if (this.resizeObserver) {
      if (typeof window.ResizeObserver === 'function') {
        this.resizeObserver.unobserve(document.body)
      } else {
        this.resizeSubscription.unsubscribe()
        delete this.resizeSubscription
      }

      delete this.resizeObserver
    }

    if (this.orientationChangeSubscription) {
      this.orientationChangeSubscription.unsubscribe()
      delete this.orientationChangeSubscription
    }
  }

  private onBodyResize () {
    if (this.isMaximized) {
      if (this.screenService.isInMobileView()) {
        this.unlockBodyScroll()
      } else {
        this.lockBodyScroll()
      }
    }
  }

  private async updatePreviews () {
    if (this.content === null || this.content === undefined) return

    this.truncatedPreviewHTML = await this.markdownRender(truncate(this.content, { length: this.truncate }))
    this.previewHTML = await this.markdownRender(this.content)
  }

  private async markdownRender (text: string) {
    const html = this.markdownType === 'text' ?
      await this.markdownService.textMarkdownToHTML(text) :
      await this.markdownService.enhancedMarkdownToHTML(text)

    return this.markdownVideo ? this.markdownService.processVideoTimestamps(html) : html
  }
}
