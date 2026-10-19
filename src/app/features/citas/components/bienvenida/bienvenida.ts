import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  template: `
    <section class="welcome" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span> PARA ALGUIEN ESPECIAL</p>
        <h1 id="welcome-title">¿Y si tenemos<br />una <em>cita?</em><span class="title-heart" aria-hidden="true">♥</span></h1>
        <p class="welcome-description">Tengo una idea que podría convertirse en un bonito recuerdo. Elige el día, escoge el plan y dejemos que el resto sea una sorpresa.</p>
        <button class="button button-primary welcome-button" type="button" (click)="startBooking.emit()">
          <span>Agendar nuestra cita</span><span aria-hidden="true">↗</span>
        </button>
        <p class="welcome-footnote"><span aria-hidden="true">✦</span> Sin presión, solo ilusión.</p>
      </div>
      <div class="welcome-image" role="img" aria-label="Una mesa acogedora preparada para compartir un momento especial">
        <div class="image-caption"><span>01 / 03</span><span>un plan por imaginar</span></div>
        <span class="image-stamp" aria-hidden="true">con<br />cariño</span>
      </div>
    </section>
  `,
})
export class BienvenidaComponent {
  @Output() startBooking = new EventEmitter<void>();
}
