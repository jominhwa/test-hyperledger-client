import { PDFPageProxy } from 'pdfjs-dist';
import { Injectable, WritableSignal, inject } from '@angular/core';
import { PdfService } from '../pdf/pdf.service';
import { DrawingService } from '../drawing/drawing.service';
import { CANVAS_CONFIG } from '../../config/canvas-css';

@Injectable({
  providedIn: 'root',
})
export class RenderingService {
  pdfService = inject(PdfService);
  drawingService = inject(DrawingService);
  pdfInfo: WritableSignal<any | null> = this.pdfService.pdfInfo;
  isPageRendering: boolean = false;
  pageNumPending: number | null = null;
  constructor() {}

  /**
   * Thumbnail의 배경 rendering
   * - canvas 대신 image 처리로 변경
   * @param {element} imgElement <img>
   * @param {number} pageNum 페이지 번호
   * @param {element} canvas <canvas>
   */
  async renderThumbBackground(imgElement: HTMLImageElement, pageNum: number) {
    // const pdfPage = this.pdfStorageService.getPdfPage(pageNum);
    const pdfPage = this.pdfInfo().pdfPages[pageNum - 1];

    // 배경 처리를 위한 임시 canvas
    const tmpCanvas = document.createElement('canvas');
    const tmpCtx = tmpCanvas.getContext('2d')!;

    // 1/2 scale로 설정 (임시)
    const viewport = pdfPage.getViewport({ scale: 0.5 });
    tmpCanvas.width = viewport.width;
    tmpCanvas.height = viewport.height;

    try {
      const renderContext = {
        canvasContext: tmpCtx,
        viewport,
      };
      /*-----------------------------------
        pdf -> tmpCanvas -> image element
        ! onload event는 굳이 필요없음.
      ------------------------------------*/
      await pdfPage.render(renderContext).promise;
      imgElement.src = tmpCanvas.toDataURL();

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  /**
   * Main Board의 Background rendering
   * - pending 처리 포함
   * @param pageNum page 번호
   */
  async renderBackground(
    tmpCanvas: HTMLCanvasElement,
    bgCanvas: HTMLCanvasElement,
    pageNum: number
  ) {
    const pdfPage = this.pdfInfo().pdfPages[pageNum - 1];

    if (!pdfPage) {
      return;
    }

    if (this.isPageRendering) {
      this.pageNumPending = pageNum;
    } else {
      this.isPageRendering = true;

      await this.rendering(pdfPage, bgCanvas, tmpCanvas);

      this.isPageRendering = false;

      if (this.pageNumPending) {
        this.renderBackground(tmpCanvas, bgCanvas, this.pageNumPending);
        this.pageNumPending = null;
      }
    }
  }

  /**
   * 공통 Rendering function
   * - tmpcanvas를 이용해서 target Canvas에 pdf draw
   * - 동일 size로 바로 rendering하는 경우 quality가 좋지 않음. (특히 text 문서의 경우.)
   * - pdf -> tmpCanvas -> targetCanvas
   * @param {pdfPage} page  pdfPage
   * @param {element} targetCanvas bgcanvas
   */
  async rendering(
    page: PDFPageProxy,
    targetCanvas: HTMLCanvasElement,
    tmpCanvas: HTMLCanvasElement
  ) {
    if (!page) {
      return false;
    }

    const viewport = page.getViewport({ scale: 1 });
    const ctx = targetCanvas.getContext('2d')!;

    const bgImgSize = {
      width: targetCanvas.width,
      height: targetCanvas.height,
    };

    try {
      const scale = targetCanvas.width / viewport.width;
      let tmpCanvasScaling;

      // scale이 작을때만 tmpcanvas size increase... : 여러가지 추가 check. ~~ todo
      if (scale <= 2 * CANVAS_CONFIG.CSS_UNIT) {
        tmpCanvasScaling = Math.max(2, CANVAS_CONFIG.deviceScale);
      } else {
        tmpCanvasScaling = CANVAS_CONFIG.deviceScale;
      }

      tmpCanvas.width =
        (bgImgSize.width * tmpCanvasScaling) / CANVAS_CONFIG.deviceScale;

      tmpCanvas.height =
        (bgImgSize.height * tmpCanvasScaling) / CANVAS_CONFIG.deviceScale;

      const zoomScale = tmpCanvas.width / viewport.width;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      const renderContext = {
        canvasContext: tmpCtx,
        viewport: page.getViewport({ scale: zoomScale }),
      };

      // tmpCanvas에 pdf 그리기
      await page.render(renderContext).promise;

      /*-------------------------------------------------
        tmpCanvas => target Canvas copy
        --> 대기중인 image가 없는 경우에만 처리.
        ---> pre-render 기능을 사용하므로 최종 image만 그려주면 됨.
      -----------------------------------------------------------*/
      if (!this.pageNumPending) {
        ctx.drawImage(tmpCanvas, 0, 0, bgImgSize.width, bgImgSize.height);
        // clear tmpCtx
        tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
      }

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  /**
   * Teacher Canvas의 board rendering
   * @param {element} targetCanvas canvas element
   * @param {number} zoomScale zoomScale
   * @param {Object} drawingEvents 판서 event (tool, points, timeDiff)
   */
  renderBoard(
    targetCanvas: HTMLCanvasElement,
    zoomScale: number,
    drawingEvents: any
  ) {
    const targetCtx = targetCanvas.getContext('2d')!;
    const scale = zoomScale || 1;
    targetCtx.clearRect(
      0,
      0,
      targetCanvas.width / scale,
      targetCanvas.height / scale
    );

    /*----------------------------------------
      해당 page의 drawing 정보가 있는 경우
      drawing Service의 'end'관련 event 이용.
    -----------------------------------------*/

    // 전체 redraw
    if (drawingEvents?.drawingEvent && drawingEvents?.drawingEvent.length > 0) {
      for (const item of drawingEvents?.drawingEvent) {
        this.drawingService.end(targetCtx, item.points, item.tool);
      }
    }
  }
}
