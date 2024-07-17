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

import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
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

import { CONFIG } from '../../../config';
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
  squarePreviewAnalysis?: any;
  verticalPreviewAnalysis?: any;
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
  math = Math;
  stars: number[] = new Array(5).fill(0);
  renderQueue: RenderQueueVariant[] = [];
  renderQueueJsonArray: string[] = [];
  negativePrompt = false;
  displayObjectTracking = true;
  weightsTextIndex = 3;
  weightsPersonFaceIndex = 1;
  weightSteps = [0, 10, 100, 1000];
  subtitlesTrack = '';

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

  constructor(
    private apiCallsService: ApiCallsService,
    private snackBar: MatSnackBar,
    private framingDialog: MatDialog
  ) {
    this.getPreviousRuns();
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

  drawFrame(entities?: any[]) {
    const context = this.canvas;
    if (!context || !entities) {
      return;
    }
    context.clearRect(
      0,
      0,
      this.previewVideoElem.nativeElement.videoWidth,
      this.previewVideoElem.nativeElement.videoHeight
    );
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
    const vw = this.previewVideoElem.nativeElement.videoWidth;
    const vh = this.previewVideoElem.nativeElement.videoHeight;
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

  // https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
  parseBase64EncodedContent(dataUrl: string) {
    const encodedContent = dataUrl.split(',')[1];
    const binaryString = atob(encodedContent);
    return new TextDecoder().decode(
      Uint8Array.from(binaryString, (m: any) => m.codePointAt(0))
    );
  }

  getAvSegments(folder: string) {
    this.segmentsStatus = 'pending';
    this.apiCallsService
      .getFromGcs(`${folder}/data.json`, 'application/json', 6000, 100)
      .subscribe({
        next: dataUrl => {
          const dataJson = JSON.parse(this.parseBase64EncodedContent(dataUrl));
          this.avSegments = dataJson.map((e: AvSegment) => {
            e.selected = false;
            return e;
          });
          this.originalAvSegments = structuredClone(this.avSegments);
          this.segmentsStatus = 'check_circle';
          this.loading = false;
          this.generatePreviews();
        },
        error: () => this.failHandler(folder),
      });
  }

  getRenderedCombos(folder: string) {
    this.combinationStatus = 'pending';
    this.apiCallsService
      .getFromGcs(`${folder}/combos.json`, 'application/json', 6000, 100)
      .subscribe({
        next: dataUrl => {
          this.combosJson = JSON.parse(this.parseBase64EncodedContent(dataUrl));
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
      .getFromGcs(`${folder}/analysis.json`, 'application/json', 6000, 100)
      .subscribe({
        next: dataUrl => {
          this.analysisJson = JSON.parse(
            this.parseBase64EncodedContent(dataUrl)
          );
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
      .getFromGcs(`${folder}/input.vtt`, 'text/vtt', 6000, 100)
      .subscribe({
        next: dataUrl => {
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
    this.squarePreviewAnalysis = undefined;
    this.verticalVideoObjects = undefined;
    this.verticalPreviewAnalysis = undefined;
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
    this.previewTrackElem.nativeElement.src = '';
    this.subtitlesTrack = '';
    this.previewVideoElem.nativeElement.pause();
    this.VideoComboComponent?.videoElem.nativeElement.pause();
    this.videoMagicPanel.close();
    this.videoCombosPanel.close();
    this.videoUploadPanel.open();
  }

  processVideo(folder: string, videoFilePath: string) {
    this.resetState();
    this.folder = folder;
    this.analyseAudio = !folder.includes(
      `${CONFIG.videoFolderNameSeparator}${CONFIG.videoFolderNoAudioSuffix}${CONFIG.videoFolderNameSeparator}`
    );
    this.videoPath = videoFilePath;
    this.previewVideoElem.nativeElement.src = this.videoPath;
    this.previewVideoElem.nativeElement.onloadeddata = () => {
      this.magicCanvas.nativeElement.width =
        this.previewVideoElem.nativeElement.videoWidth;
      this.magicCanvas.nativeElement.height =
        this.previewVideoElem.nativeElement.videoHeight;
      this.previewVideoElem.nativeElement.onloadeddata = null;
      this.canvas = this.magicCanvas.nativeElement.getContext('2d')!;
      this.calculateVideoDefaultDuration(
        this.previewVideoElem.nativeElement.duration
      );
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
    this.squareVideoObjects =
      this.squarePreviewAnalysis =
      this.verticalVideoObjects =
      this.verticalPreviewAnalysis =
        undefined;
    this.apiCallsService
      .generatePreviews(this.analysisJson, this.avSegments, {
        sourceDimensions: {
          w: this.previewVideoElem.nativeElement.videoWidth,
          h: this.previewVideoElem.nativeElement.videoHeight,
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
        this.squarePreviewAnalysis = JSON.parse(previews.square);
        this.squareVideoObjects = this.parseAnalysis(
          this.squarePreviewAnalysis,
          previewFilter
        );
        this.verticalPreviewAnalysis = JSON.parse(previews.vertical);
        this.verticalVideoObjects = this.parseAnalysis(
          this.verticalPreviewAnalysis,
          previewFilter
        );
      });
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

    const dialogRef = this.framingDialog.open(SmartFramingDialog, {
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
    for (const segment of segments ||
      this.variants![this.selectedVariant].scenes) {
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

  removeRenderQueueVariant(index: number) {
    this.renderQueueJsonArray.splice(index, 1);
    this.renderQueue.splice(index, 1);

    if (this.renderQueue.length === 0) {
      this.closeRenderQueueSidenav();
    }
  }

  loadVariant(index: number) {
    const variant = this.renderQueue[index];
    this.loadingVariant = true;
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
        squareCropAnalysis: this.squarePreviewAnalysis,
        verticalCropAnalysis: this.verticalPreviewAnalysis,
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
        scenes: Object.keys(combo.av_segments).join(', '),
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

  restoreSceneOrder() {
    if (!this.reorderSegmentsToggle?.checked) {
      this.avSegments = structuredClone(this.originalAvSegments);
      this.setSelectedSegments(this.variants![this.selectedVariant].scenes);
    }
  }
}
