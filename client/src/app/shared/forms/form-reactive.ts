import { FormGroup } from '@angular/forms'

export abstract class FormReactive {
  abstract form: FormGroup
  abstract formErrors: Object
  abstract validationMessages: Object

  abstract buildForm (): void

  protected onValueChanged (data?: any) {
    for (const field in this.formErrors) {
      // clear previous error message (if any)
      this.formErrors[field] = ''
      const control = this.form.get(field)

      if (control && control.dirty && !control.valid) {
        const messages = this.validationMessages[field]
        for (const key in control.errors) {
          this.formErrors[field] += messages[key] + ' '
        }
      }
    }
  }

  // Same as onValueChanged but force checking even if the field is not dirty
  protected forceCheck () {
    for (const field in this.formErrors) {
      // clear previous error message (if any)
      this.formErrors[field] = ''
      const control = this.form.get(field)

      if (control && !control.valid) {
        const messages = this.validationMessages[field]
        for (const key in control.errors) {
          this.formErrors[field] += messages[key] + ' '
        }
      }
    }
  }
}
