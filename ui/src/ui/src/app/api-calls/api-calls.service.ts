/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Observable, of, retry, switchMap } from 'rxjs';
import { CONFIG } from '../../../../config';
import {
  ApiCalls,
  GenerateVariantsResponse,
  GenerationSettings,
  PreviousRunsResponse,
  RenderQueueVariant,
} from './api-calls.service.interface';

@Injectable({
  providedIn: 'root',
})
export class ApiCallsService implements ApiCalls {
  constructor(
    private ngZone: NgZone,
    private httpClient: HttpClient
  ) {}

  loadPreviousRun(folder: string): string[] {
    return [
      folder,
      `${CONFIG.cloudStorage.authenticatedEndpointBase}/${CONFIG.cloudStorage.bucket}/${folder}/input.mp4`,
    ];
  }

  getUserAuthToken(): Observable<string> {
    return new Observable<string>(subscriber => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((userAuthToken: string) => {
          this.ngZone.run(() => {
            subscriber.next(userAuthToken);
            subscriber.complete();
          });
        })
        .getUserAuthToken();
    });
  }

  uploadVideo(
    file: File,
    analyseAudio: boolean,
    encodedUserId: string,
    filename = 'input.mp4',
    contentType = 'video/mp4'
  ): Observable<string[]> {
    const folder = `${file.name}--${analyseAudio ? '' : 'n--'}${Date.now()}--${encodedUserId}`;
    const fullName = encodeURIComponent(`${folder}/${filename}`);
    const url = `${CONFIG.cloudStorage.uploadEndpointBase}/b/${CONFIG.cloudStorage.bucket}/o?uploadType=media&name=${fullName}`;

    return this.getUserAuthToken().pipe(
      switchMap(userAuthToken =>
        this.httpClient
          .post(url, file, {
            headers: new HttpHeaders({
              'Authorization': `Bearer ${userAuthToken}`,
              'Content-Type': contentType,
            }),
          })
          .pipe(
            switchMap(response => {
              console.log('Upload complete!', response);
              const videoFilePath = `${CONFIG.cloudStorage.authenticatedEndpointBase}/${CONFIG.cloudStorage.bucket}/${folder}/input.mp4`;
              return of([folder, videoFilePath]);
            })
          )
      )
    );
  }

  deleteGcsFolder(folder: string): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    google.script.run.deleteGcsFolder(folder);
  }

  getFromGcs(
    url: string,
    mimeType: string,
    retryDelay?: number,
    maxRetries = 0
  ): Observable<string> {
    return new Observable<string>(subscriber => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((dataUrl?: string) => {
          if (!dataUrl) {
            subscriber.error('404');
          } else {
            this.ngZone.run(() => {
              subscriber.next(dataUrl);
              subscriber.complete();
            });
          }
        })
        .getFromGcs(url, mimeType);
    }).pipe(retry({ count: maxRetries, delay: retryDelay }));
  }

  generateVariants(
    gcsFolder: string,
    settings: GenerationSettings
  ): Observable<GenerateVariantsResponse[]> {
    return new Observable<GenerateVariantsResponse[]>(subscriber => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((variants: GenerateVariantsResponse[]) => {
          this.ngZone.run(() => {
            subscriber.next(variants);
            subscriber.complete();
          });
        })
        .generateVariants(gcsFolder, settings);
    });
  }

  getRunsFromGcs(): Observable<PreviousRunsResponse> {
    return new Observable<PreviousRunsResponse>(subscriber => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((response: PreviousRunsResponse) => {
          this.ngZone.run(() => {
            subscriber.next(response);
            subscriber.complete();
          });
        })
        .getRunsFromGcs();
    });
  }

  renderVariants(
    gcsFolder: string,
    renderQueue: RenderQueueVariant[]
  ): Observable<string> {
    return new Observable<string>(subscriber => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((response: string) => {
          this.ngZone.run(() => {
            subscriber.next(response);
            subscriber.complete();
          });
        })
        .renderVariants(gcsFolder, renderQueue);
    });
  }
}
