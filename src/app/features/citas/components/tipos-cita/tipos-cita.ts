import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface TipoCitaOption {
  name: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-tipos-cita',
  standalone: true,
  template: `
    <fieldset class="form-section">
      <legend><span class="section-number">01</span><span>¿Qué te apetece?</span></legend>
      <p class="section-hint">Elige lo que te haga sonreír. También vale cambiar de idea.</p>
      <div class="plan-grid">
        @for (plan of plans; track plan.name) {
          <button class="plan-option" [class.selected]="selected === plan.name" type="button"
            [attr.aria-pressed]="selected === plan.name" (click)="selectedChange.emit(plan.name)">
            <span class="plan-icon" aria-hidden="true">{{ plan.icon }}</span>
            <span class="plan-copy"><strong>{{ plan.name }}</strong><small>{{ plan.description }}</small></span>
            <span class="plan-check" aria-hidden="true">{{ selected === plan.name ? '✓' : '' }}</span>
          </button>
        }
      </div>
      @if (invalid) { <p class="field-error">Elige un plan para continuar.</p> }
    </fieldset>
  `,
})
export class TiposCitaComponent {
  @Input({ required: true }) plans: TipoCitaOption[] = [];
  @Input() selected = '';
  @Input() invalid = false;
  @Output() selectedChange = new EventEmitter<string>();
}
