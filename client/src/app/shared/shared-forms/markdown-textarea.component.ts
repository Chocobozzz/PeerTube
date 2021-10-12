import truncate from 'lodash-es/truncate'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { ViewportScroller } from '@angular/common'
import { Component, ElementRef, forwardRef, Input, OnInit, ViewChild } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SafeHtml } from '@angular/platform-browser'
import { MarkdownService, ScreenService } from '@app/core'
import { Video } from '@shared/models'

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

export class MarkdownTextareaComponent implements ControlValueAccessor, OnInit {
  @Input() content = ''

  @Input() classes: string[] | { [klass: string]: any[] | any } = []

  @Input() textareaMaxWidth = '100%'
  @Input() textareaHeight = '150px'

  @Input() truncate: number

  @Input() markdownType: 'text' | 'enhanced' = 'text'
  @Input() customMarkdownRenderer?: (text: string) => Promise<string | HTMLElement>

  @Input() markdownVideo: Video

  @Input() name = 'description'

  @ViewChild('textarea') textareaElement: ElementRef
  @ViewChild('previewElement') previewElement: ElementRef

  truncatedPreviewHTML: SafeHtml | string = ''
  previewHTML: SafeHtml | string = ''

  isMaximized = false
  disabled = false

  maximizeInText = $localize`Maximize editor`
  maximizeOutText = $localize`Exit maximized editor`

  private contentChanged = new Subject<string>()
  private scrollPosition: [number, number]

  constructor (
    private viewportScroller: ViewportScroller,
    private screenService: ScreenService,
    private markdownService: MarkdownService
  ) { }

  ngOnInit () {
    this.contentChanged
        .pipe(
          debounceTime(150),
          distinctUntilChanged()
        )
        .subscribe(() => this.updatePreviews())

    this.contentChanged.next(this.content)
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
    // Except on touchscreens devices, the virtual keyboard may move up and hide the textarea in maximized mode
    if (!this.screenService.isInTouchScreen()) {
      this.textareaElement.nativeElement.focus()
    }

    // Make sure the window has no scrollbars
    if (!this.isMaximized) {
      this.unlockBodyScroll()
    } else {
      this.lockBodyScroll()
    }
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  private lockBodyScroll () {
    this.scrollPosition = this.viewportScroller.getScrollPosition()
    document.getElementById('content').classList.add('lock-scroll')
  }

  private unlockBodyScroll () {
    document.getElementById('content').classList.remove('lock-scroll')
    this.viewportScroller.scrollToPosition(this.scrollPosition)
  }

  private async updatePreviews () {
    if (this.content === null || this.content === undefined) return

    this.truncatedPreviewHTML = await this.markdownRender(truncate(this.content, { length: this.truncate }))
    this.previewHTML = await this.markdownRender(this.content)
  }

  private async markdownRender (text: string) {
    let html: string

    if (this.customMarkdownRenderer) {
      const result = await this.customMarkdownRenderer(text)

      if (result instanceof HTMLElement) {
        const wrapperElement = this.previewElement.nativeElement as HTMLElement
        wrapperElement.innerHTML = ''
        wrapperElement.appendChild(result)
        return
      }

      html = result
    } else if (this.markdownType === 'text') {
      html = await this.markdownService.textMarkdownToHTML(text)
    } else {
      html = await this.markdownService.enhancedMarkdownToHTML(text)
    }

    if (this.markdownVideo) {
      html = this.markdownService.processVideoTimestamps(this.markdownVideo.shortUUID, html)
    }

    return html
  }
}
