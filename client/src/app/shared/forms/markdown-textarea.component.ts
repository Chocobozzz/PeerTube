import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { isInSmallView } from '@app/shared/misc/utils'
import { MarkdownService } from '@app/videos/shared'
import { Subject } from 'rxjs'
import truncate from 'lodash-es/truncate'

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
  @Input() classes: string[] = []
  @Input() textareaWidth = '100%'
  @Input() textareaHeight = '150px'
  @Input() previewColumn = false
  @Input() truncate: number
  @Input() markdownType: 'text' | 'enhanced' = 'text'

  textareaMarginRight = '0'
  flexDirection = 'column'
  truncatedPreviewHTML = ''
  previewHTML = ''

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

    if (this.previewColumn) {
      this.flexDirection = 'row'
      this.textareaMarginRight = '15px'
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

  arePreviewsDisplayed () {
    return isInSmallView() === false
  }

  private updatePreviews () {
    if (this.content === null || this.content === undefined) return

    this.truncatedPreviewHTML = this.markdownRender(truncate(this.content, { length: this.truncate }))
    this.previewHTML = this.markdownRender(this.content)
  }

  private markdownRender (text: string) {
    if (this.markdownType === 'text') return this.markdownService.textMarkdownToHTML(text)

    return this.markdownService.enhancedMarkdownToHTML(text)
  }
}
