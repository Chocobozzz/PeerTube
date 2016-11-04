import { LoginComponent } from './login.component';

export const LoginRoutes = [
  {
    path: 'login',
    component: LoginComponent,
    data: {
      meta: {
        titleSuffix: ' - Login'
      }
    }
  }
];
