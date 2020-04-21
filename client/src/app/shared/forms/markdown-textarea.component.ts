import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, forwardRef, Input, OnInit, OnDestroy } from '@angular/core'
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
  @Input() textareaWidth = '100%'
  @Input() textareaHeight = '150px'
  @Input() truncate: number
  @Input() markdownType: 'text' | 'enhanced' = 'text'
  @Input() markdownVideo = false
  @Input() name = 'description'

  truncatedPreviewHTML = ''
  previewHTML = ''
  isMaximized = false

  private contentChanged = new Subject<string>()
  private resizeObserver: Observable<Event>
  private resizeSubscription: Subscription

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

    if (typeof window.ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.onWindowResize)
      this.resizeObserver.observe(window)
    } else {
      this.resizeObserver = fromEvent(window, 'resize')
      this.resizeSubscription = this.resizeObserver.subscribe(this.onWindowResize)
    }
  }

  ngOnDestroy () {
    if (typeof window.ResizeObserver === 'function') {
      this.resizeObserver.unobserve(window)
    } else {
      this.resizeSubscription.unsubscribe()
    }
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
    const contentElement = document.getElementById('content')

    if (this.isMaximized) {
      this.isMaximized = false

      contentElement
        .firstElementChild
        .lastElementChild
        .classList.remove('fixed')
    } else {
      this.isMaximized = true

      contentElement
        .firstElementChild
        .lastElementChild
        .classList.add('fixed')
    }
  }

  onWindowResize () {
    if (this.isMaximized && this.screenService.isInMobileView()) {
      const contentElement = document.getElementById('content')

      contentElement
        .firstElementChild
        .lastElementChild
        .classList.remove('fixed')
    }
  }

  arePreviewsDisplayed () {
    return this.screenService.isInSmallView() === false
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
