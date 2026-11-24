import { computed, Directive, DoCheck, inject, input, Signal } from '@angular/core'
import { AbstractControl, FormArray, FormGroup, NgControl } from '@angular/forms'

/**
 * Disable the form controls of a section. For example the options of a parent checkbox that is unchecked
 * Disabled controls are not validated, so an invalid value in a disabled section cannot prevent the form from being submitted
 *
 * Components must import `DisabledFormSectionControlDirective` and submit `getFormValueToSubmit(form)` instead of `form.value`
 */
@Directive({
  selector: '[myDisabledFormSection]',
  standalone: true,
  host: {
    '[class.disabled-form-section]': 'myDisabledFormSection()'
  }
})
export class DisabledFormSectionDirective {
  private readonly parentSection = inject(DisabledFormSectionDirective, { optional: true, skipSelf: true })

  readonly myDisabledFormSection = input.required<boolean>()

  // A section is also disabled when one of its parent sections is disabled
  readonly disabled: Signal<boolean> = computed(() => this.myDisabledFormSection() || this.parentSection?.disabled() === true)
}

@Directive({
  // Applies to every control of the components importing it, so they don't need an extra attribute
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[formControlName],[formControl]',
  standalone: true
})
export class DisabledFormSectionControlDirective implements DoCheck {
  private readonly section = inject(DisabledFormSectionDirective, { optional: true })
  private readonly ngControl = inject(NgControl, { self: true })

  // Only re-enable controls disabled by this directive, not the ones the component disabled for other reasons
  private disabledBySection = false

  ngDoCheck () {
    if (!this.section) return

    const control = this.ngControl.control
    if (!control) return

    if (this.section.disabled()) {
      if (control.disabled) return

      control.disable({ emitEvent: false })
      this.disabledBySection = true
    } else {
      if (!this.disabledBySection) return

      control.enable({ emitEvent: false })
      this.disabledBySection = false
    }

    refreshRootLater(control.root)
  }
}

// Notify the root form so form errors are refreshed, after the change detection cycle
const rootsToRefresh = new Set<AbstractControl>()

function refreshRootLater (root: AbstractControl) {
  if (rootsToRefresh.has(root)) return

  rootsToRefresh.add(root)

  queueMicrotask(() => {
    rootsToRefresh.delete(root)
    root.updateValueAndValidity()
  })
}

/**
 * Omit the disabled controls having an invalid value, so the server keeps its current value
 */
export function getFormValueToSubmit<T extends AbstractControl> (control: T): ReturnType<T['getRawValue']> {
  return buildValueToSubmit(control)
}

function buildValueToSubmit (control: AbstractControl): any {
  if (control instanceof FormGroup) {
    const result: Record<string, any> = {}

    for (const [ key, child ] of Object.entries(control.controls)) {
      const value = buildValueToSubmit(child)
      if (value !== undefined) result[key] = value
    }

    return result
  }

  if (control instanceof FormArray) {
    return control.controls.map(c => buildValueToSubmit(c))
  }

  // Validators of a disabled control are not run by Angular
  // `.validator` returns `null` when the value is valid, so skip if the disabled control has an invalid value
  if (control.disabled && control.validator?.(control)) return undefined

  return control.value
}
