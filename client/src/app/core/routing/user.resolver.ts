import { inject } from '@angular/core'
import { ResolveFn } from '@angular/router'
import { first, map } from 'rxjs'
import { AuthService, AuthUser } from '../auth'

export const userResolver: ResolveFn<AuthUser> = () => {
  const auth = inject(AuthService)

  return auth.userInformationLoaded
    .pipe(first(), map(() => auth.getUser()))
}
