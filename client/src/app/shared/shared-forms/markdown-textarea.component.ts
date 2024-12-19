import { NgClass, NgIf, ViewportScroller } from '@angular/common'
import { booleanAttribute, Component, ElementRef, forwardRef, Input, OnInit, ViewChild } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SafeHtml } from '@angular/platform-browser'
import { MarkdownService, ScreenService } from '@app/core'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
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
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    NgbNav,
    NgIf,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    GlobalIconComponent,
    NgbTooltip,
    NgbNavOutlet
  ]
})

export class MarkdownTextareaComponent implements ControlValueAccessor, OnInit {
  @Input() content = ''

  @Input() formError: string | FormReactiveErrors | FormReactiveErrors[]

  @Input({ transform: booleanAttribute }) truncateTo3Lines: boolean

  @Input() markdownType: 'text' | 'enhanced' | 'to-unsafe-html' = 'text'
  @Input() customMarkdownRenderer?: (text: string) => Promise<string | HTMLElement>

  @Input() debounceTime = 150

  @Input() markdownVideo: Video

  @Input({ required: true }) inputId: string

  @Input() dir: string

  @Input({ transform: booleanAttribute }) withHtml = false
  @Input({ transform: booleanAttribute }) withEmoji = false

  @ViewChild('textarea') textareaElement: ElementRef
  @ViewChild('previewElement') previewElement: ElementRef

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
          debounceTime(this.debounceTime),
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
    if (this.disabled) return

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
      html = await this.markdownService.textMarkdownToHTML({ markdown: text, withEmoji: this.withEmoji, withHtml: this.withHtml })
    } else if (this.markdownType === 'enhanced') {
      html = await this.markdownService.enhancedMarkdownToHTML({ markdown: text, withEmoji: this.withEmoji, withHtml: this.withHtml })
    } else if (this.markdownType === 'to-unsafe-html') {
      html = await this.markdownService.markdownToUnsafeHTML({ markdown: text })
    }

    if (this.markdownVideo) {
      html = this.markdownService.processVideoTimestamps(this.markdownVideo.shortUUID, html)
    }

    return html
  }
}
