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

import { CdkDrag } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import {
  MatButtonToggleGroup,
  MatButtonToggleModule,
} from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import {
  MatExpansionModule,
  MatExpansionPanel,
} from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import {
  MatSlideToggle,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { CONFIG } from '../../../config';
import { StringUtil } from '../../../string-util';
import { TimeUtil } from '../../../time-util';
import { ApiCallsService } from './api-calls/api-calls.service';
import {
  AvSegment,
  GenerateVariantsResponse,
  RenderedVariant,
  RenderQueueVariant,
  RenderSettings,
} from './api-calls/api-calls.service.interface';
import { FileChooserComponent } from './file-chooser/file-chooser.component';
import { SmartFramingDialog } from './framing-dialog/framing-dialog.component';
import { SegmentsListComponent } from './segments-list/segments-list.component';
import { VideoComboComponent } from './video-combo/video-combo.component';

type ProcessStatus = 'hourglass_top' | 'pending' | 'check_circle';
export type FramingDialogData = {
  weightsPersonFaceIndex: number;
  weightsTextIndex: number;
  weightSteps: number[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FileChooserComponent,
    MatButtonModule,
    MatDividerModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatToolbarModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatIconModule,
    MatButtonToggleModule,
    SegmentsListComponent,
    VideoComboComponent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatBadgeModule,
    MatSliderModule,
    MatSidenavModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    CdkDrag,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  loading = false;
  generatingVariants = false;
  rendering = false;
  loadingVariant = false;
  generatingPreviews = false;
  selectedFile?: File;
  videoPath?: string;
  analysisJson?: any;
  activeVideoObjects?: any[];
  videoObjects?: any[];
  squareVideoObjects?: any[];
  verticalVideoObjects?: any[];
  combosJson?: any;
  combos?: RenderedVariant[];
  originalAvSegments?: any;
  avSegments?: any;
  variants?: GenerateVariantsResponse[];
  selectedVariant = 0;
  transcriptStatus: ProcessStatus = 'hourglass_top';
  analysisStatus: ProcessStatus = 'hourglass_top';
  combinationStatus: ProcessStatus = 'hourglass_top';
  segmentsStatus: ProcessStatus = 'hourglass_top';
  canvas?: CanvasRenderingContext2D;
  frameInterval?: number;
  currentSegmentId?: number;
  prompt = '';
  duration = 0;
  step = 0;
  renderAllFormats = true;
  audioSettings = 'segment';
  demandGenAssets = true;
  analyseAudio = true;
  previousRuns: string[] | undefined;
  encodedUserId: string | undefined;
  folder = '';
  folderGcsPath = '';
  combosFolder = '';
  math = Math;
  stars: number[] = new Array(5).fill(0);
  renderQueue: RenderQueueVariant[] = [];
  renderQueueJsonArray: string[] = [];
  negativePrompt = false;
  displayObjectTracking = true;
  moveCropArea = false;
  weightsTextIndex = 3;
  weightsPersonFaceIndex = 1;
  weightSteps = [0, 10, 100, 1000];
  subtitlesTrack = '';
  webAppUrl = '';
  dragPosition = { x: 0, y: 0 };
  cropAreaRect?: DOMRect;
  nonLandscapeInputVideo = false;
  videoWidth = 1280;
  videoHeight = 720;
  maxSquareWidth = 720;
  maxVerticalWidth = 405;
  maxNonLandscapeHeight = 720;

  @ViewChild('VideoComboComponent') VideoComboComponent?: VideoComboComponent;
  @ViewChild('previewVideoElem')
  previewVideoElem!: ElementRef<HTMLVideoElement>;
  @ViewChild('previewTrackElem')
  previewTrackElem!: ElementRef<HTMLTrackElement>;
  @ViewChild('videoUploadPanel') videoUploadPanel!: MatExpansionPanel;
  @ViewChild('videoMagicPanel') videoMagicPanel!: MatExpansionPanel;
  @ViewChild('magicCanvas') magicCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoCombosPanel') videoCombosPanel!: MatExpansionPanel;
  @ViewChild('segmentModeToggle') segmentModeToggle!: MatButtonToggleGroup;
  @ViewChild('videosFilterToggle') videosFilterToggle!: MatSlideToggle;
  @ViewChild('renderQueueSidenav') renderQueueSidenav!: MatSidenav;
  @ViewChild('renderQueueButtonSpan')
  renderQueueButtonSpan!: ElementRef<HTMLSpanElement>;
  @ViewChild('reorderSegmentsToggle') reorderSegmentsToggle?: MatSlideToggle;
  @ViewChild('previewToggleGroup') previewToggleGroup!: MatButtonToggleGroup;
  @ViewChild('canvasDragElement')
  canvasDragElement?: ElementRef<HTMLDivElement>;

  constructor(
    private apiCallsService: ApiCallsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute
  ) {
    this.getPreviousRuns();
    this.getWebAppUrl();
    this.activatedRoute.queryParams.subscribe(params => {
      const inputCombosFolder = params['inputCombosFolder'];
      if (inputCombosFolder) {
        this.handleInputCombosFolder(inputCombosFolder);
      }
    });
  }

  ngAfterViewInit() {
    const inputCombosFolder = document.querySelector(
      '#input-combos-folder'
    ) as HTMLInputElement;
    if (inputCombosFolder && inputCombosFolder.value) {
      this.handleInputCombosFolder(inputCombosFolder.value);
    }
  }

  handleInputCombosFolder(inputCombosFolder: string) {
    this.videoUploadPanel.close();
    this.getRenderedCombos(inputCombosFolder);
  }

  getWebAppUrl() {
    this.apiCallsService.getWebAppUrl().subscribe(url => {
      this.webAppUrl = url;
    });
  }

  getPreviousRuns() {
    this.apiCallsService.getRunsFromGcs().subscribe(result => {
      this.previousRuns = result.runs;
      this.encodedUserId = result.encodedUserId;
    });
  }

  isCurrentUserRun(run: string) {
    if (this.videosFilterToggle && this.videosFilterToggle.checked) {
      const encodedUserId = run.split('--').at(-1);
      return encodedUserId === this.encodedUserId;
    }
    return true;
  }

  onFileSelected(file: File) {
    this.selectedFile = file;
  }

  failHandler(folder: string) {
    this.loading = false;
    this.snackBar
      .open('An error occured.', 'Start over', {
        horizontalPosition: 'center',
      })
      .afterDismissed()
      .subscribe(() => {
        this.videoUploadPanel.open();
        this.previewVideoElem.nativeElement.pause();
        this.videoMagicPanel.close();
      });
    this.apiCallsService.deleteGcsFolder(folder);
    this.getPreviousRuns();
  }

  getCurrentCropAreaFrame(entities: any[]):
    | {
        currentFrame: { x: number; width: number; height: number };
        idx: number;
      }
    | undefined {
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    for (let i = 0; i < entities[0].frames.length; i++) {
      if (entities[0].frames[i].time >= timestamp) {
        return { currentFrame: entities[0].frames[i], idx: i };
      }
    }
    return;
  }

  drawFrame(entities?: any[]) {
    const context = this.canvas;
    if (!context || !entities) {
      return;
    }
    context.clearRect(0, 0, this.videoWidth, this.videoHeight);
    if (this.displayObjectTracking) {
      const timestamp = this.previewVideoElem.nativeElement.currentTime;
      entities.forEach(e => {
        if (e.start <= timestamp && e.end >= timestamp) {
          for (let i = 0; i < e.frames.length; i++) {
            if (e.frames[i].time >= timestamp) {
              this.drawEntity(
                e.name,
                e.frames[i].x,
                e.frames[i].y,
                e.frames[i].width,
                e.frames[i].height
              );
              break;
            }
          }
        }
      });
    }
  }

  setCurrentSegmentId() {
    if (!this.avSegments) {
      this.currentSegmentId = undefined;
      return;
    }
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    const currentSegment = this.avSegments.find(
      (segment: AvSegment) =>
        segment.start_s <= timestamp && segment.end_s >= timestamp
    );
    if (
      !currentSegment ||
      currentSegment.av_segment_id === this.currentSegmentId
    ) {
      return;
    }
    this.currentSegmentId = currentSegment.av_segment_id;
  }

  drawEntity(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const context = this.canvas;
    if (context) {
      context.font = '20px Roboto';
      context.strokeStyle = '#81c784';
      context.beginPath();
      context.lineWidth = 4;
      context.rect(x, y, width, height);
      context.stroke();
      context.fillStyle = '#81c784';
      context.fillRect(x, y, width, 32);
      context.fillStyle = '#ffffff';
      context.fillText(text, x + 5, y + 22);
    }
  }

  parseAnalysis(objectsJson: any, filterCondition: (e: any) => boolean) {
    const vw = this.videoWidth;
    const vh = this.videoHeight;
    return objectsJson.annotation_results[0].object_annotations
      .filter(filterCondition)
      .map((e: any) => {
        return {
          name: e.entity.description,
          start: TimeUtil.timestampToSeconds(e.segment.start_time_offset),
          end: TimeUtil.timestampToSeconds(e.segment.end_time_offset),
          frames: e.frames.map((f: any) => {
            return {
              x: vw * (f.normalized_bounding_box.left || 0),
              y: vh * (f.normalized_bounding_box.top || 0),
              width:
                vw *
                ((f.normalized_bounding_box.right || 0) -
                  (f.normalized_bounding_box.left || 0)),
              height:
                vh *
                ((f.normalized_bounding_box.bottom || 0) -
                  (f.normalized_bounding_box.top || 0)),
              time: TimeUtil.timestampToSeconds(f.time_offset),
            };
          }),
        };
      });
  }

  getAvSegments(folder: string) {
    this.segmentsStatus = 'pending';
    this.apiCallsService
      .getFromGcs(`${folder}/data.json`, CONFIG.retryDelay, CONFIG.maxRetries)
      .subscribe({
        next: data => {
          const dataJson = JSON.parse(data);
          this.avSegments = dataJson.map((e: AvSegment) => {
            e.selected = false;
            return e;
          });
          this.originalAvSegments = structuredClone(this.avSegments);
          this.segmentsStatus = 'check_circle';
          this.loading = false;
          if (!this.nonLandscapeInputVideo) {
            this.generatePreviews();
          }
        },
        error: () => this.failHandler(folder),
      });
  }

  getRenderedCombos(folder: string) {
    this.combosFolder = folder;
    this.loading = true;
    this.combinationStatus = 'pending';
    this.previewVideoElem.nativeElement.pause();
    this.videoMagicPanel.close();
    this.videoCombosPanel.open();
    this.apiCallsService
      .getFromGcs(`${folder}/combos.json`, CONFIG.retryDelay, CONFIG.maxRetries)
      .subscribe({
        next: data => {
          this.combosJson = JSON.parse(data);
          this.setCombos();
          this.combinationStatus = 'check_circle';
          this.loading = false;
          this.previewVideoElem.nativeElement.pause();
          this.videoMagicPanel.close();
          this.videoCombosPanel.open();
        },
        error: () => this.failHandler(folder),
      });
  }

  getVideoAnalysis(folder: string) {
    this.analysisStatus = 'pending';
    this.apiCallsService
      .getFromGcs(
        `${folder}/analysis.json`,
        CONFIG.retryDelay,
        CONFIG.maxRetries
      )
      .subscribe({
        next: data => {
          this.analysisJson = JSON.parse(data);
          this.analysisStatus = 'check_circle';
          this.videoObjects = this.parseAnalysis(
            this.analysisJson,
            (e: any) =>
              e.confidence > CONFIG.videoIntelligenceConfidenceThreshold
          );
          this.activeVideoObjects = this.videoObjects;
          this.getAvSegments(folder);
        },
        error: () => this.failHandler(folder),
      });
  }

  getSubtitlesTrack(folder: string) {
    this.transcriptStatus = 'pending';
    this.apiCallsService
      .getFromGcs(`${folder}/input.vtt`, CONFIG.retryDelay, CONFIG.maxRetries)
      .subscribe({
        next: data => {
          const dataUrl = `data:text/vtt;base64,${StringUtil.encode(data)}`;
          this.previewTrackElem.nativeElement.src = dataUrl;
          this.subtitlesTrack = this.previewTrackElem.nativeElement.src;
          this.transcriptStatus = 'check_circle';
          this.getVideoAnalysis(folder);
        },
        error: () => this.failHandler(folder),
      });
  }

  loadPreviousRun(folder: string) {
    this.loading = true;
    const response = this.apiCallsService.loadPreviousRun(folder);
    this.processVideo(response[0], response[1]);
  }

  uploadVideo() {
    this.loading = true;
    this.apiCallsService
      .uploadVideo(this.selectedFile!, this.analyseAudio, this.encodedUserId!)
      .subscribe(response => {
        this.processVideo(response[0], response[1]);
      });
  }

  resetState() {
    this.rendering = false;
    this.generatingPreviews = false;
    this.analysisJson = undefined;
    this.avSegments = undefined;
    this.originalAvSegments = undefined;
    this.combosJson = undefined;
    this.combos = undefined;
    this.activeVideoObjects = undefined;
    this.videoObjects = undefined;
    this.squareVideoObjects = undefined;
    this.verticalVideoObjects = undefined;
    this.variants = undefined;
    this.transcriptStatus = 'hourglass_top';
    this.analysisStatus = 'hourglass_top';
    this.combinationStatus = 'hourglass_top';
    this.segmentsStatus = 'hourglass_top';
    this.renderQueue = [];
    this.renderQueueJsonArray = [];
    this.segmentModeToggle.value = 'preview';
    this.previewToggleGroup.value = 'toggle';
    this.displayObjectTracking = true;
    this.moveCropArea = false;
    this.previewTrackElem.nativeElement.src = '';
    this.subtitlesTrack = '';
    this.cropAreaRect = undefined;
    this.nonLandscapeInputVideo = false;
    this.previewVideoElem.nativeElement.pause();
    this.VideoComboComponent?.videoElem.nativeElement.pause();
    this.videoMagicPanel.close();
    this.videoCombosPanel.close();
    this.videoUploadPanel.open();
  }

  resetVideoCanvas() {
    this.magicCanvas.nativeElement.style.removeProperty('width');
    this.magicCanvas.nativeElement.style.removeProperty('height');
    this.videoWidth = 1280;
    this.videoHeight = 720;
    const segmentsListElement = document.querySelector(
      'segments-list'
    )! as HTMLElement;
    segmentsListElement.style.setProperty('--filmstrip-image-width', '256px');
    segmentsListElement.style.setProperty('--filmstrip-image-height', '144px');
  }

  processVideo(folder: string, videoFilePath: string) {
    this.resetState();
    this.folder = folder;
    this.analyseAudio = !folder.includes(
      `${CONFIG.videoFolderNameSeparator}${CONFIG.videoFolderNoAudioSuffix}${CONFIG.videoFolderNameSeparator}`
    );
    this.videoPath = videoFilePath;
    this.getGcsFolderPath();
    this.previewVideoElem.nativeElement.src = this.videoPath;
    this.previewVideoElem.nativeElement.onloadeddata = () => {
      this.resetVideoCanvas();
      this.nonLandscapeInputVideo =
        this.previewVideoElem.nativeElement.videoWidth <=
        this.previewVideoElem.nativeElement.videoHeight;

      if (this.nonLandscapeInputVideo) {
        this.videoWidth = Math.min(
          this.previewVideoElem.nativeElement.videoWidth,
          this.previewVideoElem.nativeElement.videoWidth ===
            this.previewVideoElem.nativeElement.videoHeight
            ? this.maxSquareWidth
            : this.maxVerticalWidth
        );
        this.videoHeight = Math.min(
          this.previewVideoElem.nativeElement.videoHeight,
          this.maxNonLandscapeHeight
        );
        const segmentsListElement = document.querySelector(
          'segments-list'
        )! as HTMLElement;
        segmentsListElement.style.setProperty(
          '--filmstrip-image-width',
          this.videoWidth / 5 + 'px'
        );
        segmentsListElement.style.setProperty(
          '--filmstrip-image-height',
          this.videoHeight / 5 + 'px'
        );
        this.renderAllFormats = false;
      } else {
        this.magicCanvas.nativeElement.setAttribute(
          'style',
          'width: 100%; height: 100%'
        );
      }
      this.magicCanvas.nativeElement.width = this.videoWidth;
      this.magicCanvas.nativeElement.height = this.videoHeight;
      this.canvas = this.magicCanvas.nativeElement.getContext('2d')!;
      this.calculateVideoDefaultDuration(
        this.previewVideoElem.nativeElement.duration
      );
      this.previewVideoElem.nativeElement.onloadeddata = null;
    };
    this.previewVideoElem.nativeElement.onplaying = () => {
      this.frameInterval = window.setInterval(() => {
        this.drawFrame(this.activeVideoObjects);
        const skipped = this.skipSegment();
        if (!skipped) {
          this.setCurrentSegmentId();
        }
      }, 10);
    };
    this.previewVideoElem.nativeElement.onpause = () => {
      if (this.frameInterval) {
        clearInterval(this.frameInterval);
        this.frameInterval = undefined;
      }
    };
    this.previewVideoElem.nativeElement.onended = () => {
      this.resetVariantPreview();
    };
    this.videoUploadPanel.close();
    this.videoMagicPanel.open();
    this.getSubtitlesTrack(folder);
  }

  getGcsFolderPath() {
    this.apiCallsService
      .getGcsFolderPath(this.folder)
      .subscribe((path: string) => {
        this.folderGcsPath = path;
      });
  }

  calculateVideoDefaultDuration(duration: number) {
    const step = duration >= 60 ? 10 : 5;
    const halfDuration = Math.round(duration / 2);

    this.step = step;
    this.duration = Math.min(30, halfDuration - (halfDuration % step));
  }

  generateVariants() {
    this.loading = true;
    this.generatingVariants = true;
    this.apiCallsService
      .generateVariants(this.folder, {
        prompt: this.prompt,
        duration: this.duration,
        demandGenAssets: this.demandGenAssets,
        negativePrompt: this.negativePrompt,
      })
      .subscribe(variants => {
        this.loading = false;
        this.generatingVariants = false;
        this.selectedVariant = 0;
        this.variants = variants;
        this.setSelectedSegments();
        this.displayObjectTracking = false;
      });
  }

  generatePreviews(loading = false) {
    this.loading = loading;
    this.generatingPreviews = true;
    this.squareVideoObjects = this.verticalVideoObjects = undefined;
    this.apiCallsService
      .generatePreviews(this.analysisJson, this.avSegments, {
        sourceDimensions: {
          w: Math.min(
            this.videoWidth,
            this.previewVideoElem.nativeElement.videoWidth
          ),
          h: Math.min(
            this.videoHeight,
            this.previewVideoElem.nativeElement.videoHeight
          ),
        },
        weights: {
          text: this.weightSteps[this.weightsTextIndex],
          face: this.weightSteps[this.weightsPersonFaceIndex],
          objects: {
            person: this.weightSteps[this.weightsPersonFaceIndex],
          },
        },
      })
      .subscribe(previews => {
        this.generatingPreviews = false;
        if (loading) {
          this.loading = false;
        }
        const previewFilter = (e: any) => e.entity.description === 'crop-area';
        const squarePreviewAnalysis = JSON.parse(previews.square);
        this.squareVideoObjects = this.parseAnalysis(
          squarePreviewAnalysis,
          previewFilter
        );
        const verticalPreviewAnalysis = JSON.parse(previews.vertical);
        this.verticalVideoObjects = this.parseAnalysis(
          verticalPreviewAnalysis,
          previewFilter
        );
      });
  }

  toggleMoveCropArea() {
    this.segmentModeToggle.value = 'preview';
    this.moveCropArea = !this.moveCropArea;
    const { currentFrame, idx } = this.getCurrentCropAreaFrame(
      this.activeVideoObjects!
    )!;
    const canvasViewWidth = this.magicCanvas.nativeElement.scrollWidth;
    const canvasViewHeight = this.magicCanvas.nativeElement.scrollHeight;

    if (this.moveCropArea) {
      while (this.canvasDragElement?.nativeElement.firstChild) {
        this.canvasDragElement?.nativeElement.removeChild(
          this.canvasDragElement?.nativeElement.firstChild
        );
      }
      const outputX = (currentFrame.x * canvasViewWidth) / this.videoWidth;
      const outputWidth =
        (currentFrame.width * canvasViewWidth) / this.videoWidth;
      const outputHeight =
        (currentFrame.height * canvasViewHeight) / this.videoHeight;

      const img = document.createElement('img');
      img.src = this.magicCanvas.nativeElement.toDataURL('image/png');
      img.setAttribute(
        'style',
        `object-position: -${outputX}px; clip-path: rect(0px ${outputWidth}px ${outputHeight}px 0px); width: ${canvasViewWidth}px; height: ${canvasViewHeight}px;`
      );
      this.canvasDragElement?.nativeElement.appendChild(img);
      this.canvasDragElement?.nativeElement.setAttribute(
        'style',
        `position: absolute; display: block; left: ${outputX}px; width: ${outputWidth}px; height: ${outputHeight}px`
      );
      this.magicCanvas.nativeElement.style.visibility = 'hidden';
      this.canvas!.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.previewVideoElem.nativeElement.controls = false;
      this.cropAreaRect = img.getBoundingClientRect();
    } else {
      const imgElement = this.canvasDragElement?.nativeElement
        .firstChild as HTMLImageElement;
      const newX =
        currentFrame.x +
        ((imgElement.getBoundingClientRect().x - this.cropAreaRect!.x) *
          this.videoWidth) /
          canvasViewWidth;
      this.updateVideoObjects(currentFrame.x, newX, idx);

      this.dragPosition = { x: 0, y: 0 };
      this.canvasDragElement?.nativeElement.setAttribute(
        'style',
        'display: none'
      );
      this.magicCanvas.nativeElement.style.visibility = 'visible';
      this.previewVideoElem.nativeElement.controls = true;
    }
  }

  updateVideoObjects(currentX: number, newX: number, idx: number) {
    const cropArea = this.activeVideoObjects![0];
    const [startIdx, endIdx] = this.getMatchingCropAreaIndexRange(
      currentX,
      idx
    );
    for (let i = startIdx; i < endIdx; i++) {
      if (cropArea.frames[i].x === currentX) {
        cropArea.frames[i].x = newX;
      }
    }
  }

  getMatchingCropAreaIndexRange(currentX: number, idx: number) {
    const cropArea = this.activeVideoObjects![0];
    let startIdx = 0,
      endIdx = cropArea.frames.length;

    for (let i = idx; i < cropArea.frames.length; i++) {
      if (cropArea.frames[i].x !== currentX) {
        endIdx = i;
        break;
      }
    }
    for (let i = idx; i >= 0; i--) {
      if (cropArea.frames[i].x !== currentX) {
        startIdx = i + 1;
        break;
      }
    }
    return [startIdx, endIdx];
  }

  loadPreview() {
    this.activeVideoObjects = this.videoObjects;
    this.previewTrackElem.nativeElement.src = this.subtitlesTrack;
    switch (this.previewToggleGroup.value) {
      case 'square':
        this.displayObjectTracking = true;
        this.previewTrackElem.nativeElement.src = '';
        this.activeVideoObjects = this.squareVideoObjects;
        break;
      case 'vertical':
        this.displayObjectTracking = true;
        this.previewTrackElem.nativeElement.src = '';
        this.activeVideoObjects = this.verticalVideoObjects;
        break;
      case 'toggle':
        this.displayObjectTracking = !this.displayObjectTracking;
        break;
      case 'settings':
        this.openSmartFramingDialog();
        break;
    }
  }

  openSmartFramingDialog() {
    const { bottom, left } =
      this.previewToggleGroup._buttonToggles.last._buttonElement.nativeElement.getClientRects()[0];

    const dialogRef = this.dialog.open(SmartFramingDialog, {
      data: {
        weightsPersonFaceIndex: this.weightsPersonFaceIndex,
        weightsTextIndex: this.weightsTextIndex,
        weightSteps: this.weightSteps,
      },
      position: {
        top: `${bottom + 24}px`,
        left: `${left - 100}px`,
      },
      height: '300px',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: FramingDialogData | undefined) => {
        if (
          result &&
          (this.weightsPersonFaceIndex !== result.weightsPersonFaceIndex ||
            this.weightsTextIndex !== result.weightsTextIndex)
        ) {
          this.weightsPersonFaceIndex = result.weightsPersonFaceIndex;
          this.weightsTextIndex = result.weightsTextIndex;
          this.generatePreviews(true);
        }
      });
  }

  skipSegment() {
    if (!this.avSegments || !this.variants) {
      return false;
    }
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    const currentSegment = this.avSegments.find(
      (segment: AvSegment) =>
        segment.start_s <= timestamp && segment.end_s >= timestamp
    );
    if (!currentSegment) {
      return false;
    }
    const allSelected = this.avSegments
      .filter((segment: AvSegment) => segment.selected)
      .map((segment: AvSegment) => segment.av_segment_id + 1);
    const allPlayed = this.avSegments
      .filter((segment: AvSegment) => segment.played)
      .map((segment: AvSegment) => segment.av_segment_id + 1);

    const lastSelectedSegmentToBePlayed = this.avSegments.findLast(
      (segment: AvSegment) => segment.selected
    );
    const nextPlayableSegment = this.avSegments.find(
      (segment: AvSegment) => segment.selected && !segment.played
    );

    const currentSegmentPlaying =
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id === currentSegment.av_segment_id;
    const currentSegmentIsNotNext =
      currentSegment.selected &&
      !currentSegment.played &&
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id !== currentSegment.av_segment_id;
    const allSegmentsPlayed =
      JSON.stringify(allPlayed) === JSON.stringify(allSelected) &&
      timestamp >= lastSelectedSegmentToBePlayed.end_s;
    const currentSegmentAlreadyPlayed =
      currentSegment.played &&
      allPlayed.indexOf(currentSegment.av_segment_id + 1) !==
        allPlayed.length - 1 &&
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id !== currentSegment.av_segment_id;
    const skipSegment = !currentSegment.selected || currentSegmentAlreadyPlayed;

    if (currentSegmentPlaying) {
      currentSegment.played = true;
    } else if (
      currentSegmentIsNotNext ||
      currentSegmentAlreadyPlayed ||
      !currentSegment.selected
    ) {
      this.previewVideoElem.nativeElement.currentTime = nextPlayableSegment
        ? nextPlayableSegment.start_s
        : this.previewVideoElem.nativeElement.duration;
    } else if (allSegmentsPlayed) {
      this.previewVideoElem.nativeElement.currentTime =
        this.previewVideoElem.nativeElement.duration;
    }
    return skipSegment;
  }

  seekToSegment(index: number) {
    const segment = this.avSegments![index];
    this.previewVideoElem.nativeElement.currentTime = segment.start_s;
  }

  setSelectedSegments(segments?: number[]) {
    for (const segment of this.avSegments) {
      segment.selected = false;
    }
    const segmentsToSelect =
      segments ?? this.variants?.[this.selectedVariant].scenes ?? [];
    for (const segment of segmentsToSelect) {
      this.avSegments[segment - 1].selected = true;
    }
  }

  variantChanged() {
    if (!this.loadingVariant) {
      this.avSegments = structuredClone(this.originalAvSegments);
      this.setSelectedSegments();
      this.resetVariantPreview();
    }
  }

  resetVariantPreview() {
    const firstUnplayedSegment = this.avSegments?.find(
      (segment: AvSegment) => segment.selected && !segment.played
    );
    const firstSelectedSegment =
      this.avSegments && this.variants
        ? this.avSegments[this.variants[this.selectedVariant].scenes[0] - 1]
        : null;
    this.previewVideoElem.nativeElement.currentTime = firstUnplayedSegment
      ? firstUnplayedSegment.start_s
      : firstSelectedSegment
        ? firstSelectedSegment.start_s
        : 0;
    this.setCurrentSegmentId();
    if (
      firstUnplayedSegment &&
      firstSelectedSegment &&
      firstUnplayedSegment.av_segment_id !== firstSelectedSegment.av_segment_id
    ) {
      this.previewVideoElem.nativeElement.play();
    } else if (!firstUnplayedSegment) {
      this.avSegments?.forEach((segment: AvSegment) => {
        segment.played = false;
      });
    }
  }

  addToRenderQueue() {
    const variant = this.variants![this.selectedVariant];
    const selectedSegments = this.avSegments!.filter(
      (segment: AvSegment) => segment.selected
    ).map((segment: AvSegment) => {
      return {
        av_segment_id: segment.av_segment_id + 1,
        start_s: segment.start_s,
        end_s: segment.end_s,
        segment_screenshot_uri: segment.segment_screenshot_uri,
      };
    });
    const renderSettings: RenderSettings = {
      generate_image_assets: this.demandGenAssets,
      generate_text_assets: this.demandGenAssets,
      render_all_formats: this.renderAllFormats,
      use_music_overlay: this.audioSettings === 'music',
      use_continuous_audio: this.audioSettings === 'continuous',
    };
    const selectedScenes = selectedSegments.map(
      (segment: AvSegment) => segment.av_segment_id
    );
    const duration = TimeUtil.secondsToTimeString(
      selectedSegments.reduce(
        (total: number, segment: AvSegment) =>
          total + segment.end_s - segment.start_s,
        0
      )
    );
    const renderQueueVariant: RenderQueueVariant = {
      original_variant_id: this.selectedVariant,
      av_segments: selectedSegments,
      title: variant.title,
      description: variant.description,
      score: variant.score,
      score_reasoning: variant.reasoning,
      render_settings: renderSettings,
      duration: duration,
      scenes: selectedScenes.join(', '),
      userSelection:
        JSON.stringify(variant.scenes) !== JSON.stringify(selectedScenes),
    };
    const renderQueueVariantJson = JSON.stringify(renderQueueVariant);
    if (!this.renderQueueJsonArray.includes(renderQueueVariantJson)) {
      this.renderQueueJsonArray.push(renderQueueVariantJson);
      this.renderQueue.push(renderQueueVariant);
    }
    this.renderQueueSidenav.autoFocus = true;
    this.renderQueueSidenav.open();
    this.renderQueueSidenav.autoFocus = false;
  }

  toggleRenderQueueSidenav() {
    if (this.renderQueue.length) {
      this.renderQueueSidenav.toggle();
    }
  }

  removeRenderQueueVariant(event: Event, index: number) {
    this.renderQueueJsonArray.splice(index, 1);
    this.renderQueue.splice(index, 1);

    if (this.renderQueue.length === 0) {
      this.closeRenderQueueSidenav();
    }
    event.stopPropagation();
  }

  loadVariant(index: number) {
    const variant = this.renderQueue[index];
    this.loadingVariant = true;
    this.avSegments?.forEach((segment: AvSegment) => {
      segment.played = false;
    });
    this.selectedVariant = variant.original_variant_id;
    this.setSelectedSegments(
      variant.av_segments.map((segment: AvSegment) => segment.av_segment_id)
    );
    this.renderAllFormats = variant.render_settings.render_all_formats;
    this.demandGenAssets =
      variant.render_settings.generate_text_assets &&
      variant.render_settings.generate_image_assets;
    this.audioSettings = variant.render_settings.use_music_overlay
      ? 'music'
      : variant.render_settings.use_continuous_audio
        ? 'continuous'
        : 'segment';
    this.closeRenderQueueSidenav();
    setTimeout(() => {
      this.loadingVariant = false;
    }, 1000);
  }

  closeRenderQueueSidenav() {
    this.renderQueueSidenav.close();
    const trenderQueueButton = this.renderQueueButtonSpan.nativeElement
      .firstChild! as HTMLButtonElement;
    trenderQueueButton.blur();
  }

  renderVariants() {
    this.loading = true;
    this.rendering = true;
    this.apiCallsService
      .renderVariants(this.folder, {
        queue: this.renderQueue,
        squareCropAnalysis: this.squareVideoObjects,
        verticalCropAnalysis: this.verticalVideoObjects,
        sourceDimensions: {
          w: this.previewVideoElem.nativeElement.videoWidth,
          h: this.previewVideoElem.nativeElement.videoHeight,
        },
      })
      .subscribe(combosFolder => {
        this.loading = false;
        this.renderQueue = [];
        this.renderQueueJsonArray = [];
        this.closeRenderQueueSidenav();
        this.getRenderedCombos(combosFolder);
      });
  }

  setCombos() {
    this.combos = Object.values(this.combosJson).map((combo: any) => {
      const segments = Object.values(combo.av_segments) as AvSegment[];
      const duration = TimeUtil.secondsToTimeString(
        segments.reduce(
          (total: number, segment: AvSegment) =>
            total + segment.end_s - segment.start_s,
          0
        )
      );
      const renderedVariant: RenderedVariant = {
        variant_id: combo.variant_id,
        av_segments: combo.av_segments,
        title: combo.title,
        description: combo.description,
        score: combo.score,
        reasoning: combo.score_reasoning,
        variants: combo.variants,
        duration: duration,
        scenes: segments
          .map((segment: AvSegment) => segment.av_segment_id)
          .join(', '),
      };
      if (combo.images) {
        renderedVariant.images = combo.images;
      }
      if (combo.texts) {
        renderedVariant.texts = combo.texts;
      }
      return renderedVariant;
    });
  }

  restoreSegmentOrder() {
    if (
      !this.reorderSegmentsToggle?.checked &&
      JSON.stringify(this.avSegments) !==
        JSON.stringify(this.originalAvSegments)
    ) {
      this.avSegments = structuredClone(this.originalAvSegments);
      this.setSelectedSegments(this.variants![this.selectedVariant].scenes);
    }
  }
}
