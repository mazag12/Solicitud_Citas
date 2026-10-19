import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CitaService } from './core/services/cita.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{
        provide: CitaService,
        useValue: { getDisponibilidad: () => of({ timezone: 'America/Lima', days: [1, 2, 3, 4, 5, 6, 7], slots: ['10:00'] }) },
      }],
    }).compileComponents();
  });

  it('should create the invitation page', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the personalized welcome and booking action', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('¿Y si tenemosuna cita?');
    expect(compiled.querySelector('button')?.textContent).toContain('Agendar nuestra cita');
  });

  it('should update the summary and offer configured times for a future date', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.welcome-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.plan-option') as HTMLButtonElement).click();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dateInput = compiled.querySelector('#fecha') as HTMLInputElement;
    dateInput.value = futureDate.toISOString().slice(0, 10);
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.plan-option')?.classList.contains('selected')).toBe(true);
    expect(compiled.querySelector('.summary dd')?.textContent).toContain('Café y conversación');
    expect(compiled.querySelector('option[value="10:00"]')).toBeTruthy();
  });
});
