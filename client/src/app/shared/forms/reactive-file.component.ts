import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-reactive-file',
  styleUrls: [ './reactive-file.component.scss' ],
  templateUrl: './reactive-file.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ReactiveFileComponent),
      multi: true
    }
  ]
})
export class ReactiveFileComponent implements OnInit, ControlValueAccessor {
  @Input() inputLabel: string
  @Input() inputName: string
  @Input() extensions: string[] = []
  @Input() maxFileSize: number
  @Input() displayFilename = false

  @Output() fileChanged = new EventEmitter<Blob>()

  allowedExtensionsMessage = ''
  fileInputValue: any

  private file: File

  constructor (
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {}

  get filename () {
    if (!this.file) return ''

    return this.file.name
  }

  ngOnInit () {
    this.allowedExtensionsMessage = this.extensions.join(', ')
  }

  fileChange (event: any) {
    if (event.target.files && event.target.files.length) {
      const [ file ] = event.target.files

      if (file.size > this.maxFileSize) {
        this.notificationsService.error(this.i18n('Error'), this.i18n('This file is too large.'))
        return
      }

      this.file = file

      this.propagateChange(this.file)
      this.fileChanged.emit(this.file)
    }
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (file: any) {
    this.file = file

    if (!this.file) this.fileInputValue = null
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }
}
