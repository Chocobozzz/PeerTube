import { enableProdMode, provide } from '@angular/core';
import { disableDeprecatedForms, provideForms } from '@angular/forms';
import {
  HTTP_PROVIDERS,
  RequestOptions,
  XHRBackend
} from '@angular/http';
import { bootstrap }    from '@angular/platform-browser-dynamic';
import { provideRouter } from '@angular/router';

import { routes } from './app/app.routes';
import { AuthHttp, AuthService, RestExtractor } from './app/shared';
import { AppComponent } from './app/app.component';

if (process.env.ENV === 'production') {
  enableProdMode();
}

bootstrap(AppComponent, [
  HTTP_PROVIDERS,
  provide(AuthHttp, {
    useFactory: (backend: XHRBackend, defaultOptions: RequestOptions, authService: AuthService) => {
      return new AuthHttp(backend, defaultOptions, authService);
    },
    deps: [ XHRBackend, RequestOptions, AuthService ]
  }),

  AuthService,
  RestExtractor,

  provideRouter(routes),

  disableDeprecatedForms(),
  provideForms()
]);
