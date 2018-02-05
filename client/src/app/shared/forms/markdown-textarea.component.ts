import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import 'rxjs/add/operator/debounceTime'
import 'rxjs/add/operator/distinctUntilChanged'
import { isInMobileView } from '@app/shared/misc/utils'
import { MarkdownService } from '@app/videos/shared'
import { Subject } from 'rxjs/Subject'
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
  @Input() description = ''
  @Input() classes: string[] = []
  @Input() textareaWidth = '100%'
  @Input() textareaHeight = '150px'
  @Input() previewColumn = false
  @Input() truncate: number

  textareaMarginRight = '0'
  flexDirection = 'column'
  truncatedDescriptionHTML = ''
  descriptionHTML = ''

  private descriptionChanged = new Subject<string>()

  constructor (private markdownService: MarkdownService) {}

  ngOnInit () {
    this.descriptionChanged
      .debounceTime(150)
      .distinctUntilChanged()
      .subscribe(() => this.updateDescriptionPreviews())

    this.descriptionChanged.next(this.description)

    if (this.previewColumn) {
      this.flexDirection = 'row'
      this.textareaMarginRight = '15px'
    }
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (description: string) {
    this.description = description

    this.descriptionChanged.next(this.description)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.description)

    this.descriptionChanged.next(this.description)
  }

  arePreviewsDisplayed () {
    return isInMobileView() === false
  }

  private updateDescriptionPreviews () {
    if (this.description === null || this.description === undefined) return

    this.truncatedDescriptionHTML = this.markdownService.markdownToHTML(truncate(this.description, { length: this.truncate }))
    this.descriptionHTML = this.markdownService.markdownToHTML(this.description)
  }
}
