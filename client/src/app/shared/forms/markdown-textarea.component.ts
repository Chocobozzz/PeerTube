import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Subject } from 'rxjs'
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

export class MarkdownTextareaComponent implements ControlValueAccessor, OnInit {
  @Input() content = ''
  @Input() classes: string[] | { [klass: string]: any[] | any } = []
  @Input() textareaWidth = '100%'
  @Input() textareaHeight = '150px'
  @Input() previewColumn = false
  @Input() truncate: number
  @Input() markdownType: 'text' | 'enhanced' = 'text'
  @Input() markdownVideo = false
  @Input() name = 'description'

  textareaMarginRight = '0'
  flexDirection = 'column'
  truncatedPreviewHTML = ''
  previewHTML = ''

  private contentChanged = new Subject<string>()

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
