import { CommonModule } from '@angular/common'
import { Component, forwardRef, inject, input, OnChanges, OnInit, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier } from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'

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
  ],
  imports: [ CommonModule, NgbTooltipModule, FormsModule, GlobalIconComponent ]
})
export class ReactiveFileComponent implements OnInit, OnChanges, ControlValueAccessor {
  private notifier = inject(Notifier)

  readonly theme = input<'primary' | 'secondary'>('secondary')
  readonly inputLabel = input<string>(undefined)
  readonly inputName = input<string>(undefined)
  readonly extensions = input<string[]>([])
  readonly maxFileSize = input<number>(undefined)

  readonly displayFilename = input(false)
  readonly displayReset = input(false)

  readonly icon = input<GlobalIconName>(undefined)
  readonly buttonTooltip = input<string>(undefined)

  readonly fileChanged = output<Blob>()

  classes: { [id: string]: boolean } = {}
  allowedExtensionsMessage = ''
  fileInputValue: any
  file: File

  get filename () {
    if (!this.file) return ''

    return this.file.name
  }

  ngOnInit () {
    this.allowedExtensionsMessage = this.extensions().join(', ')

    this.buildClasses()
  }

  ngOnChanges () {
    this.buildClasses()
  }

  buildClasses () {
    this.classes = {
      'with-icon': !!this.icon(),
      'primary-button': this.theme() === 'primary',
      'secondary-button': this.theme() === 'secondary',
      'icon-only': !this.inputLabel()
    }
  }

  fileChange (event: any) {
    if (event.target.files?.length) {
      const [ file ] = event.target.files

      if (file.size > this.maxFileSize()) {
        this.notifier.error($localize`This file is too large.`)
        return
      }

      const extension = '.' + file.name.split('.').pop()
      if (this.extensions().includes(extension.toLowerCase()) === false) {
        const message = $localize`PeerTube cannot handle this kind of file. Accepted extensions are ${this.allowedExtensionsMessage}.`
        this.notifier.error(message)

        return
      }

      this.file = file

      this.propagateChange(this.file)
    }
    this.fileChanged.emit(this.file)
  }

  reset () {
    this.writeValue(undefined)
    this.propagateChange(undefined)
    this.fileChanged.emit(undefined)
  }

  propagateChange = (_: any) => {
    // empty
  }

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
