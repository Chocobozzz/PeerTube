import { enableProdMode } from '@angular/core';
import { bootstrap }    from '@angular/platform-browser-dynamic';

import { AppComponent } from './app/app.component';

if (process.env.ENV === 'production') {
  enableProdMode();
}

bootstrap(AppComponent);
