import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-resumen-cita',
  standalone: true,
  template: `
    <aside class="summary" aria-labelledby="summary-title">
      <div class="summary-topline"><span>UN PEQUEÑO RESUMEN</span><span aria-hidden="true">✳</span></div>
      <h3 id="summary-title">Por ahora,<br /><em>esto imaginamos</em></h3>
      <dl>
        <div><dt>El plan</dt><dd>{{ plan || 'Aún por elegir' }}</dd></div>
        <div><dt>El día</dt><dd>{{ date }}</dd></div>
        <div><dt>La hora</dt><dd>{{ time || 'Aún por elegir' }}</dd></div>
        <div><dt>El lugar</dt><dd>{{ place || 'Lo decidimos juntos' }}</dd></div>
      </dl>
      @if (message) { <blockquote>“{{ message }}”</blockquote> }
      <div class="summary-signoff"><span class="signoff-heart" aria-hidden="true">♥</span><span>Con ganas de verte</span></div>
    </aside>
  `,
})
export class ResumenCitaComponent {
  @Input() plan = '';
  @Input() date = 'Aún por elegir';
  @Input() time = '';
  @Input() place = '';
  @Input() message = '';
}
