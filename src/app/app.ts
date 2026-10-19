import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CitaService, Disponibilidad } from './core/services/cita.service';
import { BienvenidaComponent } from './features/citas/components/bienvenida/bienvenida';
import { ConfirmacionCitaComponent } from './features/citas/components/confirmacion-cita/confirmacion-cita';
import { ResumenCitaComponent } from './features/citas/components/resumen-cita/resumen-cita';
import { TiposCitaComponent } from './features/citas/components/tipos-cita/tipos-cita';
import { Cita } from './features/citas/models/cita.model';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, BienvenidaComponent, ConfirmacionCitaComponent, ResumenCitaComponent, TiposCitaComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly formBuilder = inject(FormBuilder);
  private readonly citaService = inject(CitaService);
  protected readonly plans = [
    { name: 'Café y conversación', icon: '☕', description: 'Un café, muchas sonrisas y una buena charla.' },
    { name: 'Una cena especial', icon: '🍽️', description: 'Buena comida y una compañía aún mejor.' },
    { name: 'Un paseo juntos', icon: '🌅', description: 'Un lugar bonito y tiempo para disfrutar.' },
    { name: 'Una película', icon: '🎬', description: 'Una buena historia y la mejor compañía.' },
    { name: 'Una sorpresa', icon: '🎁', description: 'Déjame organizar algo especial.' },
    { name: 'Otro plan', icon: '💕', description: 'Cuéntame esa idea diferente.' },
  ];
  protected readonly today = this.todayInLima();
  protected readonly maxDate = this.addDays(this.today, 180);
  protected readonly started = signal(false);
  protected readonly sent = signal(false);
  protected readonly sending = signal(false);
  protected readonly availability = signal<Disponibilidad | null>(null);
  protected readonly availabilityError = signal(false);
  protected readonly submitError = signal('');
  protected readonly availableSlots = signal<string[]>([]);
  protected readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    correo: ['', [Validators.email, Validators.maxLength(254)]],
    tipoCita: ['', Validators.required],
    fecha: ['', Validators.required],
    hora: ['', Validators.required],
    lugar: ['', Validators.maxLength(160)],
    mensaje: ['', Validators.maxLength(1000)],
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.citaService.getDisponibilidad().subscribe({
      next: (availability) => {
        this.availability.set(availability);
        this.availabilityError.set(false);
        this.updateSlots(this.form.controls.fecha.value);
      },
      error: () => this.availabilityError.set(true),
    });

    this.form.controls.fecha.valueChanges.subscribe((date) => {
      this.form.controls.hora.setValue('');
      this.updateSlots(date);
      this.submitError.set('');
    });
  }

  protected startBooking(): void {
    this.started.set(true);
    window.setTimeout(() => document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  protected selectPlan(name: string): void {
    this.form.controls.tipoCita.setValue(name);
    this.form.controls.tipoCita.markAsTouched();
  }

  protected formattedDate(): string {
    const value = this.form.controls.fecha.value;
    if (!value) return 'Aún por elegir';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${value}T12:00:00Z`));
  }

  protected submit(): void {
    this.submitError.set('');
    if (this.sending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.isSelectedSlotAvailable()) {
      this.submitError.set('Revisa los datos: necesitamos un plan, fecha, horario y tu nombre.');
      return;
    }

    this.sending.set(true);
    const request: Cita = this.form.getRawValue();
    this.citaService.enviarCita(request).pipe(finalize(() => this.sending.set(false))).subscribe({
      next: () => this.sent.set(true),
      error: (error: HttpErrorResponse) => {
        this.submitError.set(error.status === 503
          ? 'El servicio de invitaciones no está disponible todavía. Inténtalo más tarde.'
          : 'No se pudo enviar la invitación. Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }

  private updateSlots(date: string): void {
    const schedule = this.availability();
    if (!date || !schedule || date < this.today || date > this.maxDate) {
      this.availableSlots.set([]);
      return;
    }
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    if (!schedule.days.includes(weekday)) {
      this.availableSlots.set([]);
      return;
    }
    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date());
    this.availableSlots.set(date === this.today ? schedule.slots.filter((slot) => slot > now) : schedule.slots);
  }

  private isSelectedSlotAvailable(): boolean {
    const date = this.form.controls.fecha.value;
    const hour = this.form.controls.hora.value;
    return date >= this.today && date <= this.maxDate && this.availableSlots().includes(hour);
  }

  private todayInLima(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private addDays(date: string, count: number): string {
    const result = new Date(`${date}T12:00:00Z`);
    result.setUTCDate(result.getUTCDate() + count);
    return result.toISOString().slice(0, 10);
  }
}
