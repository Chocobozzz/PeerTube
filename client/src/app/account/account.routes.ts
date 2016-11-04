import { AccountComponent } from './account.component';

export const AccountRoutes = [
  {
    path: 'account',
    component: AccountComponent,
    data: {
      meta: {
        titleSuffix: ' - My account'
      }
    }
  }
];
