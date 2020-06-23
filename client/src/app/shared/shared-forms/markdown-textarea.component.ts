import truncate from 'lodash-es/truncate'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, ElementRef, forwardRef, Input, OnInit, ViewChild } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { MarkdownService } from '@app/core'

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
  @Input() markdownVideo = false
  @Input() name = 'description'

  @ViewChild('textarea') textareaElement: ElementRef

  truncatedPreviewHTML = ''
  previewHTML = ''
  isMaximized = false

  private contentChanged = new Subject<string>()

  constructor (private markdownService: MarkdownService) {}

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
    this.textareaElement.nativeElement.focus()

    // Make sure the window has no scrollbars
    if (!this.isMaximized) {
      this.unlockBodyScroll()
    } else {
      this.lockBodyScroll()
    }
  }

  private lockBodyScroll () {
    document.getElementById('content').classList.add('lock-scroll')
  }

  private unlockBodyScroll () {
    document.getElementById('content').classList.remove('lock-scroll')
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
