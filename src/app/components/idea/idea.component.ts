import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TravelStateService } from '../../services/travel-state.service';

@Component({
  selector: 'app-idea',
  templateUrl: './idea.component.html',
  styleUrls: ['./idea.component.scss']
})
export class IdeaComponent implements OnInit {
  ideaDraft = '';
  ideaError = '';

  constructor(
    private router: Router,
    private state: TravelStateService
  ) {}

  ngOnInit(): void {
    this.ideaDraft = '';
    this.ideaError = '';
  }

  onBack(): void {
    this.state.clearIdea();
    this.router.navigate(['/']);
  }

  onSubmit(): void {
    const idea = this.ideaDraft.trim();

    if (!idea) {
      this.ideaError = '请填写你的旅行想法，告诉我们想去哪里、想怎么玩。';
      return;
    }

    if (idea.length > 500) {
      this.ideaError = '旅行想法最多 500 字，请精简后再提交。';
      return;
    }

    this.ideaError = '';
    this.state.prepareIdea(idea);
    this.state.clearCurrentPlan();
    this.state.regenerate$.next(this.state.preferences);
    this.router.navigate(['/result']);
  }
}
