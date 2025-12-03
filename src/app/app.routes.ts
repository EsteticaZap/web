import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LandpageComponent } from './landpage/landpage.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'landpage', component: LandpageComponent },
  { path: '', redirectTo: '/landpage', pathMatch: 'full' }
];
