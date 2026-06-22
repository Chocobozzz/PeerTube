import { NgTemplateOutlet } from '@angular/common'
import { AfterContentInit, booleanAttribute, Component, contentChildren, forwardRef, input, model, TemplateRef, ChangeDetectionStrategy } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { PeerTubeTemplateDirective } from '../shared-main/common/peertube-template.directive'

@Component({
  selector: 'my-peertube-checkbox',
  styleUrls: [ './peertube-checkbox.component.scss' ],
  templateUrl: './peertube-checkbox.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PeertubeCheckboxComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, NgTemplateOutlet, HelpComponent ]
})
export class PeertubeCheckboxComponent implements ControlValueAccessor, AfterContentInit {
  readonly checked = model(false)
  readonly inputName = input<string>(undefined)
  readonly labelText = input<string>(undefined)
  readonly labelInnerHTML = input<string>(undefined)
  readonly helpPlacement = input('top auto')
  readonly recommended = input(false, { transform: booleanAttribute })
  readonly small = input(false, { transform: booleanAttribute })

  disabled = false
  describedby: string

  readonly templates = contentChildren(PeerTubeTemplateDirective)

  labelTemplate: TemplateRef<any>
  helpTemplate: TemplateRef<any>

  ngAfterContentInit () {
    {
      const t = this.templates().find(t => t.name() === 'label')
      if (t) this.labelTemplate = t.template
    }

    {
      const t = this.templates().find(t => t.name() === 'help')
      if (t) this.helpTemplate = t.template
    }
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (checked: boolean) {
    this.checked.set(checked)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.checked())
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }
}
