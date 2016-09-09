import { NgModule, ApplicationRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpModule, RequestOptions, XHRBackend } from '@angular/http';
import { RouterModule } from '@angular/router';
import { removeNgStyles, createNewHosts } from '@angularclass/hmr';

import { FileSelectDirective } from 'ng2-file-upload/ng2-file-upload';
import { ProgressbarModule } from 'ng2-bootstrap/components/progressbar';
import { PaginationModule } from 'ng2-bootstrap/components/pagination';
import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';

/*
 * Platform and Environment providers/directives/pipes
 */
import { ENV_PROVIDERS } from './environment';
import { routes } from './app.routes';
// App is our top level component
import { AppComponent } from './app.component';
import { AppState } from './app.service';
import { AccountComponent, AccountService } from './account';
import { LoginComponent } from './login';
import {
  LoaderComponent,
  VideosComponent,
  VideoAddComponent,
  VideoListComponent,
  VideoMiniatureComponent,
  VideoSortComponent,
  VideoWatchComponent,
  VideoService,
  WebTorrentService
} from './videos';
import {
  FriendsComponent,
  FriendAddComponent,
  FriendListComponent,
  FriendService,
  UsersComponent,
  UserAddComponent,
  UserListComponent,
  UserService,
  AdminComponent,
  MenuAdminComponent
} from './admin';
import { MenuComponent } from './menu.component';
import { AuthService, AuthHttp, RestExtractor, RestService, SearchComponent, SearchService } from './shared';

// Application wide providers
const APP_PROVIDERS = [
  AppState,

  {
    provide: AuthHttp,
    useFactory: (backend: XHRBackend, defaultOptions: RequestOptions, authService: AuthService) => {
      return new AuthHttp(backend, defaultOptions, authService);
    },
    deps: [ XHRBackend, RequestOptions, AuthService ]
  },

  AuthService,
  RestExtractor,
  RestExtractor, RestService, VideoService, SearchService, FriendService, UserService, AccountService, WebTorrentService
];
/**
 * `AppModule` is the main entry point into Angular2's bootstraping process
 */
@NgModule({
  bootstrap: [ AppComponent ],
  declarations: [
    AppComponent,
    BytesPipe,
    FileSelectDirective,
    AccountComponent,
    LoginComponent,
    LoaderComponent,
    VideosComponent,
    VideoAddComponent,
    VideoListComponent,
    VideoSortComponent,
    VideoMiniatureComponent,
    VideoWatchComponent,
    FriendsComponent,
    FriendAddComponent,
    FriendListComponent,
    UsersComponent,
    UserAddComponent,
    UserListComponent,
    AdminComponent,
    MenuAdminComponent,
    MenuComponent,
    SearchComponent
  ],
  imports: [ // import Angular's modules
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule.forRoot(routes),
    ProgressbarModule,
    PaginationModule
  ],
  providers: [ // expose our Services and Providers into Angular's dependency injection
    ENV_PROVIDERS,
    APP_PROVIDERS
  ]
})
export class AppModule {
  constructor(public appRef: ApplicationRef, public appState: AppState) {}
  hmrOnInit(store) {
    if (!store || !store.state) return;
    console.log('HMR store', store);
    this.appState._state = store.state;
    this.appRef.tick();
    delete store.state;
  }
  hmrOnDestroy(store) {
    const cmpLocation = this.appRef.components.map(cmp => cmp.location.nativeElement);
    // recreate elements
    const state = this.appState._state;
    store.state = state;
    store.disposeOldHosts = createNewHosts(cmpLocation);
    // remove styles
    removeNgStyles();
  }
  hmrAfterDestroy(store) {
    // display new elements
    store.disposeOldHosts();
    delete store.disposeOldHosts;
  }
}
