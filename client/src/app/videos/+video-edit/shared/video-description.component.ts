import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { truncate } from 'lodash'
import 'rxjs/add/operator/debounceTime'
import 'rxjs/add/operator/distinctUntilChanged'
import { Subject } from 'rxjs/Subject'
import { MarkdownService } from '../../shared'

@Component({
  selector: 'my-video-description',
  templateUrl: './video-description.component.html',
  styleUrls: [ './video-description.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VideoDescriptionComponent),
      multi: true
    }
  ]
})

export class VideoDescriptionComponent implements ControlValueAccessor, OnInit {
  @Input() description = ''
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

  private updateDescriptionPreviews () {
    this.truncatedDescriptionHTML = this.markdownService.markdownToHTML(truncate(this.description, { length: 250 }))
    this.descriptionHTML = this.markdownService.markdownToHTML(this.description)
  }
}
