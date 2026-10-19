import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Cita } from '../../features/citas/models/cita.model';

export interface Disponibilidad {
  timezone: 'America/Lima';
  days: number[];
  slots: string[];
}

@Injectable({ providedIn: 'root' })
export class CitaService {
  private readonly http = inject(HttpClient);

  getDisponibilidad(): Observable<Disponibilidad> {
    return this.http.get<Disponibilidad>('/api/citas/disponibilidad');
  }

  enviarCita(cita: Cita): Observable<{ received: true }> {
    return this.http.post<{ received: true }>('/api/citas', cita);
  }
}
