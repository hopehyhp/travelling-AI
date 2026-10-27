import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { QuestionnaireComponent } from './components/questionnaire/questionnaire.component';
import { IdeaComponent } from './components/idea/idea.component';
import { ResultComponent } from './components/result/result.component';
import { AuthComponent } from './components/auth/auth.component';
import { SharedComponent } from './components/shared/shared.component';
import { ProfileComponent } from './components/profile/profile.component';

const routes: Routes = [
  { path: '', component: LandingComponent, pathMatch: 'full' },
  { path: 'wizard', component: QuestionnaireComponent },
  { path: 'idea', component: IdeaComponent },
  { path: 'result', component: ResultComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'share/:token', component: SharedComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
