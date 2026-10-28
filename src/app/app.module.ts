import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { SharedModule } from './shared/primeng.module';
import { AppComponent } from './app.component';
import { LandingComponent } from './components/landing/landing.component';
import { QuestionnaireComponent } from './components/questionnaire/questionnaire.component';
import { IdeaComponent } from './components/idea/idea.component';
import { ResultComponent } from './components/result/result.component';
import { AuthComponent } from './components/auth/auth.component';
import { SharedComponent } from './components/shared/shared.component';
import { ProfileComponent } from './components/profile/profile.component';

import { AuthInterceptor } from './services/auth.interceptor';
import { PlanSaveDialogComponent } from './components/result/plan-save-dialog.component';
import { PlanShareDialogComponent } from './components/result/plan-share-dialog.component';
import { SpotReplacementPanelComponent } from './components/result/spot-replacement-panel.component';
import { SpotDetailModalComponent } from './components/result/spot-detail-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingComponent,
    QuestionnaireComponent,
    IdeaComponent,
    ResultComponent,
    AuthComponent,
    SharedComponent,
    ProfileComponent,
    PlanSaveDialogComponent,
    PlanShareDialogComponent,
    SpotReplacementPanelComponent,
    SpotDetailModalComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    SharedModule,
    HttpClientModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
