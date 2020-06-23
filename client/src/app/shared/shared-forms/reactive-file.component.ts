import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier } from '@app/core'
import { GlobalIconName } from '@app/shared/shared-icons'
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
  @Input() icon: GlobalIconName

  @Output() fileChanged = new EventEmitter<Blob>()

  allowedExtensionsMessage = ''
  fileInputValue: any

  private file: File

  constructor (
    private notifier: Notifier,
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
        this.notifier.error(this.i18n('This file is too large.'))
        return
      }

      const extension = '.' + file.name.split('.').pop()
      if (this.extensions.includes(extension) === false) {
        const message = this.i18n(
          'PeerTube cannot handle this kind of file. Accepted extensions are {{extensions}}.',
          { extensions: this.allowedExtensionsMessage }
        )
        this.notifier.error(message)

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
