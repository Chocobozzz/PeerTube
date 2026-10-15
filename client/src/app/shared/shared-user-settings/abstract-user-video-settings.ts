import { booleanAttribute, Directive, inject, input, OnDestroy, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { UserUpdateMe } from '@peertube/peertube-models'
import { pick } from 'lodash-es'
import { Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { BuildFormArgumentTyped } from '../form-validators/form-validator.model'

@Directive()
export abstract class AbstractUserVideoSettings<Form extends Record<string, any>> implements OnInit, OnDestroy {
  protected formReactiveService = inject(FormReactiveService)
  protected authService = inject(AuthService)
  protected notifier = inject(Notifier)
  protected userService = inject(UserService)
  protected serverService = inject(ServerService)

  readonly user = input<User>(null)
  readonly reactiveUpdate = input(false, { transform: booleanAttribute })
  readonly notifyOnUpdate = input(true, { transform: booleanAttribute })
  readonly userInformationLoaded = input<Subject<any>>(undefined)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  formValuesWatcher: Subscription

  protected abstract readonly formKeys: BuildFormArgumentTyped<Form>
  protected abstract readonly updatedMessage: string

  protected abstract patchForm (): void
  protected abstract buildUpdateDetails (): UserUpdateMe | undefined

  ngOnInit () {
    this.buildForm()
    this.onFormBuilt()

    this.userInformationLoaded().pipe(first())
      .subscribe(() => {
        this.patchForm()

        if (this.reactiveUpdate()) this.handleReactiveUpdate()
      })
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
  }

  updateDetails (onlyKeys?: string[]) {
    let details = this.buildUpdateDetails()
    if (!details) return

    if (onlyKeys) details = pick(details, this.expandOnlyKeys(onlyKeys))

    if (this.authService.isLoggedIn()) {
      return this.updateLoggedProfile(details)
    }

    return this.updateAnonymousProfile(details)
  }

  protected onFormBuilt () {
    // Can be overridden
  }

  // Some form keys are mapped to multiple user update keys
  protected expandOnlyKeys (onlyKeys: string[]) {
    return onlyKeys
  }

  private buildForm () {
    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(this.formKeys)

    this.form = form as unknown as FormGroup<Form>
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  private handleReactiveUpdate () {
    let oldForm = { ...this.form.value }

    this.formValuesWatcher = this.form.valueChanges.subscribe((formValue: any) => {
      const updatedKey = Object.keys(formValue)
        .find(k => formValue[k] !== ((oldForm as any)[k]))

      oldForm = { ...this.form.value }

      this.updateDetails([ updatedKey ])
    })
  }

  private updateLoggedProfile (details: UserUpdateMe) {
    this.userService.updateMyProfile(details)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()

          if (this.notifyOnUpdate()) this.notifier.success(this.updatedMessage)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private updateAnonymousProfile (details: UserUpdateMe) {
    this.userService.updateMyAnonymousProfile(details)

    if (this.notifyOnUpdate()) this.notifier.success(this.updatedMessage)
  }
}
