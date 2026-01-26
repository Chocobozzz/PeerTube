import { Component, inject, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { CanComponentDeactivate, Notifier } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomMarkupHelpComponent } from '../../../shared/shared-custom-markup/custom-markup-help.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  homepageContent: FormControl<string>
}

@Component({
  selector: 'my-admin-config-homepage',
  templateUrl: './admin-config-homepage.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CustomMarkupHelpComponent,
    MarkdownTextareaComponent,
    AdminSaveBarComponent
  ]
})
export class AdminConfigHomepageComponent implements OnInit, CanComponentDeactivate {
  private formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)

  private route = inject(ActivatedRoute)
  private customMarkup = inject(CustomMarkupService)
  private customPage = inject(CustomPageService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  ngOnInit () {
    this.buildForm()
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }

  save () {
    this.customPage.updateInstanceHomepage(this.form.value.homepageContent)
      .subscribe({
        next: () => {
          this.form.markAsPristine()

          this.notifier.success($localize`Homepage updated.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private buildForm () {
    const obj: BuildFormArgument = {
      homepageContent: null
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, { homepageContent: this.route.snapshot.data['homepageContent'] })

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }
}
