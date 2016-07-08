import { enableProdMode } from '@angular/core';
import { bootstrap }    from '@angular/platform-browser-dynamic';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

if (process.env.ENV === 'production') {
  enableProdMode();
}

bootstrap(AppComponent, [ provideRouter(routes) ]);
