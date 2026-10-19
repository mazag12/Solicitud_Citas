import { Component } from '@angular/core';

@Component({
  selector: 'app-confirmacion-cita',
  standalone: true,
  template: `
    <section class="success-view" aria-live="polite" aria-labelledby="success-title">
      <div class="success-decoration" aria-hidden="true">✳</div>
      <p class="eyebrow"><span class="eyebrow-line"></span> INVITACIÓN ENVIADA</p>
      <h1 id="success-title">¡Tenemos una<br /><em>posible cita</em><br />en camino! <span class="title-heart">♥</span></h1>
      <p class="success-message">Tu invitación ha sido enviada. Ahora solo queda esperar la confirmación y empezar a imaginar ese bonito momento.</p>
      <p class="success-signoff">Con cariño,<br /><strong>Alguien que tiene muchas ganas de verte.</strong></p>
      <p class="success-status">Esta solicitud aún no es una cita confirmada; recibirás mi respuesta pronto.</p>
    </section>
  `,
})
export class ConfirmacionCitaComponent {}
