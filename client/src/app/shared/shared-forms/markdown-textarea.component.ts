import { CommonModule, NgTemplateOutlet, ViewportScroller } from '@angular/common'
import { booleanAttribute, Component, ElementRef, forwardRef, inject, input, model, OnDestroy, OnInit, viewChild } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SafeHtml } from '@angular/platform-browser'
import { MarkdownService, ScreenService } from '@app/core'
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap'
import { Video } from '@peertube/peertube-models'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { FormReactiveErrors } from './form-reactive.service'

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
  ],
  imports: [
    CommonModule,
    FormsModule,
    NgbCollapseModule,
    NgTemplateOutlet,
    GlobalIconComponent
  ]
})
export class MarkdownTextareaComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private viewportScroller = inject(ViewportScroller)
  private screenService = inject(ScreenService)
  private markdownService = inject(MarkdownService)

  readonly previewEl = viewChild<ElementRef<HTMLElement>>('previewEl')

  readonly content = model('')

  readonly formError = input<string | FormReactiveErrors | FormReactiveErrors[]>(undefined)

  readonly markdownType = input<'text' | 'enhanced' | 'to-unsafe-html'>('text')
  readonly customMarkdownRenderer = input<(text: string) => Promise<string | HTMLElement>>(undefined)

  readonly debounceTime = input(150)

  readonly markdownVideo = input<Pick<Video, 'shortUUID'>>(undefined)

  readonly inputId = input.required<string>()

  readonly dir = input<string>(undefined)

  readonly withPreview = input(true, { transform: booleanAttribute })
  readonly withHtml = input(false, { transform: booleanAttribute })
  readonly withEmoji = input(false, { transform: booleanAttribute })
  readonly withShowMoreButton = input(false, { transform: booleanAttribute })

  readonly monospace = input(false, { transform: booleanAttribute })

  readonly textareaElement = viewChild<ElementRef>('textarea')
  readonly previewElement = viewChild<ElementRef>('previewElement')

  previewHTML: SafeHtml | string = ''

  maximized = false
  disabled = false
  previewCollapsed = true
  truncated = false

  private contentChanged = new Subject<string>()
  private scrollPosition: [number, number]

  ngOnInit () {
    this.contentChanged
      .pipe(
        debounceTime(this.debounceTime()),
        distinctUntilChanged()
      )
      .subscribe(() => this.updatePreviews())

    this.contentChanged.next(this.content())

    this.truncated = this.withShowMoreButton()
  }

  ngOnDestroy () {
    this.unlockBodyScroll()
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (description: string) {
    this.content.set(description)

    this.contentChanged.next(this.content())
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    const content = this.content()
    this.propagateChange(content)

    this.contentChanged.next(content)
  }

  onMaximizeClick () {
    if (this.disabled) return

    this.maximized = !this.maximized

    // Make sure textarea have the focus
    // Except on touchscreens devices, the virtual keyboard may move up and hide the textarea in maximized mode
    if (!this.screenService.isInTouchScreen()) {
      this.textareaElement().nativeElement.focus()
    }

    // Make sure the window has no scrollbars
    if (!this.maximized) {
      this.unlockBodyScroll()
    } else {
      this.lockBodyScroll()
    }
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  hasEllipsis () {
    const el = this.previewEl()?.nativeElement
    if (!el) return false

    return el.offsetHeight < el.scrollHeight
  }

  private lockBodyScroll () {
    this.scrollPosition = this.viewportScroller.getScrollPosition()
    document.getElementById('content').classList.add('lock-scroll')
  }

  private unlockBodyScroll () {
    document.getElementById('content').classList.remove('lock-scroll')

    if (this.scrollPosition) {
      this.viewportScroller.scrollToPosition(this.scrollPosition)
    }
  }

  private async updatePreviews () {
    const content = this.content()
    if (content === null || content === undefined) return

    this.previewHTML = await this.markdownRender(content)
  }

  private async markdownRender (text: string) {
    let html: string

    const customMarkdownRenderer = this.customMarkdownRenderer()
    const markdownType = this.markdownType()
    if (customMarkdownRenderer) {
      const result = await customMarkdownRenderer(text)

      if (result instanceof HTMLElement) {
        setTimeout(() => {
          const wrapperElement = this.previewElement()?.nativeElement as HTMLElement
          if (!wrapperElement) return

          wrapperElement.innerHTML = ''
          wrapperElement.appendChild(result)
        })

        return
      }

      html = result
    } else if (markdownType === 'text') {
      html = await this.markdownService.textMarkdownToHTML({ markdown: text, withEmoji: this.withEmoji(), withHtml: this.withHtml() })
    } else if (markdownType === 'enhanced') {
      html = await this.markdownService.enhancedMarkdownToHTML({ markdown: text, withEmoji: this.withEmoji(), withHtml: this.withHtml() })
    } else if (markdownType === 'to-unsafe-html') {
      html = await this.markdownService.markdownToUnsafeHTML({ markdown: text })
    }

    const markdownVideo = this.markdownVideo()
    if (markdownVideo) {
      html = this.markdownService.processVideoTimestamps(markdownVideo.shortUUID, html)
    }

    return html
  }
}
