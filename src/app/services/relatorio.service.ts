import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RelatorioService {
  private http = inject(HttpClient);

  async baixarRelatorioPdf(salonId: string): Promise<HttpResponse<Blob>> {
    return firstValueFrom(
      this.http.get(`https://esteticazap-webhook.onrender.com/saloes/${salonId}/relatorio`, {
        observe: 'response',
        responseType: 'blob',
        headers: {
          accept: 'application/pdf'
        }
      })
    );
  }
}
