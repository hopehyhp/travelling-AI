import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TravelStateService } from '../../services/travel-state.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  constructor(
    private router: Router,
    private state: TravelStateService
  ) {}

  onStart(): void {
    this.router.navigate(['/wizard']);
  }

  onIdeaStart(): void {
    this.state.clearIdea();
    this.router.navigate(['/idea']);
  }
}
