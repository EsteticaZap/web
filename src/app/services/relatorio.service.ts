import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RelatorioService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  async baixarRelatorioPdf(salonId: string): Promise<HttpResponse<Blob>> {
    const authorization = await this.authService.getAuthorizationHeader();

    return firstValueFrom(
      this.http.get(`https://esteticazap-webhook.onrender.com/saloes/${salonId}/relatorio`, {
        observe: 'response',
        responseType: 'blob',
        headers: {
          accept: 'application/pdf',
          ...(authorization ? { Authorization: authorization } : {})
        }
      })
    );
  }
}
