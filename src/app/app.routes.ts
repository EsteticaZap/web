import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LandpageComponent } from './landpage/landpage.component';
import { HomeComponent } from './home/home.component';
import { AgendaComponent } from './agenda/agenda.component';

export const publicRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'landpage', component: LandpageComponent },
  { path: '', redirectTo: '/landpage', pathMatch: 'full' }
];

export const privateRoutes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'agenda', component: AgendaComponent },
];

export const routes: Routes = [
  ...publicRoutes,
  ...privateRoutes
];
