/** 游戏引擎基类
 *  负责：
 *  - 管理 Canvas / 音频 / 当前时间
 *  - requestAnimationFrame 循环
 *  - 调用子类的 update / render / onInput
 *  - 维护分数状态（通过 Judger）
 */
import type { ParsedBeatmap, HitObject, Judgement } from "@/types";
import {
  createInitialScore,
  applyJudgement,
  windowsForOD,
  judgeByDelta,
  type ScoreState,
  type JudgementWindows,
} from "./Judger";
import type { CanvasContext } from "./renderer/Canvas2D";
import { setupCanvas, clear } from "./renderer/Canvas2D";

export interface EngineCallbacks {
  onScoreUpdate?: (score: ScoreState) => void;
  onFinish?: (score: ScoreState) => void;
}

export abstract class GameEngine {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasContext;
  protected audio: HTMLAudioElement;
  protected beatmap: ParsedBeatmap;
  protected offset: number; // ms，玩家可调
  protected windows: JudgementWindows;

  protected score: ScoreState = createInitialScore();
  protected rafId: number | null = null;
  protected status: "idle" | "playing" | "paused" | "finished" = "idle";
  protected startTime = 0; // performance.now() 起点
  protected audioStartedAt = 0; // audio.currentTime 起点
  protected callbacks: EngineCallbacks;

  protected isLandscape = false;
  protected auto = false;
  protected showCursor = false;
  protected cursorX = -100;
  protected cursorY = -100;
  protected cursorTargetX = -100;
  protected cursorTargetY = -100;

  protected backgroundImage: HTMLImageElement | null = null;
  protected backgroundLoaded = false;
  private lastFrameAt = 0;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    audio: HTMLAudioElement;
    beatmap: ParsedBeatmap;
    offset?: number;
    isLandscape?: boolean;
    callbacks?: EngineCallbacks;
    backgroundUrl?: string;
    auto?: boolean;
    showCursor?: boolean;
  }) {
    this.canvas = opts.canvas;
    this.ctx = setupCanvas(opts.canvas);
    this.audio = opts.audio;
    this.beatmap = opts.beatmap;
    this.offset = opts.offset || 0;
    this.windows = windowsForOD(opts.beatmap.od);
    this.isLandscape = opts.isLandscape ?? this.ctx.width >= this.ctx.height;
    this.callbacks = opts.callbacks || {};
    this.auto = opts.auto ?? false;
    this.showCursor = opts.showCursor ?? false;
    if (opts.backgroundUrl) this.loadBackground(opts.backgroundUrl);
  }

  private loadBackground(url: string): void {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.backgroundImage = img;
      this.backgroundLoaded = true;
    };
    img.onerror = () => {
      this.backgroundLoaded = false;
    };
    img.src = url;
  }

  /** 横竖屏切换 */
  setOrientation(isLandscape: boolean): void {
    this.isLandscape = isLandscape;
    this.ctx = setupCanvas(this.canvas);
    this.onLayoutChange();
  }

  protected onLayoutChange(): void {
    // 子类重写
  }

  /** 当前游戏时间（毫秒，基于音频播放时间） */
  getCurrentTime(): number {
    if (this.status === "playing") {
      return this.audio.currentTime * 1000 + this.offset;
    }
    if (this.status === "paused") {
      return this.audio.currentTime * 1000 + this.offset;
    }
    return 0;
  }

  /** 启动游戏 */
  start(): void {
    if (this.status !== "idle") return;
    this.status = "playing";
    this.audio.volume = 1;
    this.audio.currentTime = 0;
    this.audio.play().catch(() => {
      // 自动播放可能被阻拦，等用户首次交互
    });
    this.startTime = performance.now();
    this.audioStartedAt = 0;
    this.loop();
  }

  pause(): void {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.audio.pause();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "playing";
    this.audio.play().catch(() => {});
    this.lastFrameAt = 0;
    this.loop();
  }

  restart(): void {
    this.score = createInitialScore();
    this.resetState();
    this.audio.currentTime = 0;
    this.status = "playing";
    this.audio.play().catch(() => {});
    this.lastFrameAt = 0;
    this.loop();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.status = "finished";
    this.audio.pause();
  }

  /** 主循环 */
  protected loop = (): void => {
    if (this.status !== "playing") return;
    const now = performance.now();
    const dt = this.lastFrameAt ? Math.min((now - this.lastFrameAt) / 1000, 0.05) : 0;
    this.lastFrameAt = now;
    const time = this.getCurrentTime();
    this.update(time);
    this.smoothCursor(dt);
    this.render();
    this.drawCursor();
    this.callbacks.onScoreUpdate?.(this.score);

    // 检查是否结束（所有 hitObjects 已处理 + 音频结束）
    if (this.isFinished(time)) {
      this.finish();
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  protected finish(): void {
    this.status = "finished";
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callbacks.onFinish?.(this.score);
  }

  /** 是否所有对象都已处理完 */
  protected isFinished(time: number): boolean {
    const lastObj = this.beatmap.hitObjects[this.beatmap.hitObjects.length - 1];
    if (!lastObj) return true;
    const lastTime = lastObj.endTime || lastObj.time;
    if (time < lastTime + 2000) return false;
    // 还要等音频播完
    if (!this.audio.ended && this.audio.currentTime < (lastTime + 2000) / 1000) return false;
    return true;
  }

  /** 提交一次判定 */
  protected submitJudgement(j: Judgement): void {
    this.score = applyJudgement(this.score, j);
  }

  /** 超时未点击 → miss（子类可调用） */
  protected checkMiss(time: number, obj: HitObject): boolean {
    if (obj.judged) return false;
    const delta = time - obj.time;
    if (delta > this.windows["50"]) {
      obj.judged = true;
      obj.judgement = "miss";
      this.submitJudgement("miss");
      return true;
    }
    return false;
  }

  /** 用时间差判定一个对象 */
  protected judgeHit(obj: HitObject, time: number): Judgement {
    const delta = time - obj.time;
    const j = judgeByDelta(delta, this.windows);
    obj.judged = true;
    obj.judgement = j;
    this.submitJudgement(j);
    return j;
  }

  /** 清屏并绘制基础背景 */
  protected clearScreen(): void {
    const { ctx, width, height } = this.ctx;
    if (this.backgroundLoaded && this.backgroundImage && this.backgroundImage.complete && this.backgroundImage.naturalWidth > 0) {
      const img = this.backgroundImage;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = width / height;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (canvasAspect > imgAspect) {
        drawW = width;
        drawH = width / imgAspect;
        drawX = 0;
        drawY = (height - drawH) / 2;
      } else {
        drawH = height;
        drawW = height * imgAspect;
        drawX = (width - drawW) / 2;
        drawY = 0;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.fillRect(0, 0, width, height);
    } else {
      clear(this.ctx, "#000");
    }
  }

  /** 光标位置更新 */
  public setCursorPos(x: number, y: number): void {
    this.cursorTargetX = x;
    this.cursorTargetY = y;
    if (!this.auto) {
      this.cursorX = x;
      this.cursorY = y;
    }
  }

  /** 自动模式下对光标做平滑插值，避免瞬移 */
  private smoothCursor(dt: number): void {
    if (!this.auto) return;
    if (this.cursorTargetX < 0 || this.cursorTargetY < 0) return;
    const omega = 18; // 约 88ms 时间常数
    const k = 1 - Math.exp(-omega * dt);
    this.cursorX += (this.cursorTargetX - this.cursorX) * k;
    this.cursorY += (this.cursorTargetY - this.cursorY) * k;
  }

  /** 绘制光标 */
  protected drawCursor(): void {
    if (!this.showCursor) return;
    const { ctx } = this.ctx;
    const x = this.cursorX;
    const y = this.cursorY;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // === 抽象方法（子类实现） ===
  protected abstract update(time: number): void;
  protected abstract render(): void;
  public abstract onPointerDown(x: number, y: number): void;
  public abstract onPointerMove?(x: number, y: number): void;
  public abstract onPointerUp?(x: number, y: number): void;
  public abstract onKeyDown(key: string): void;
  public abstract onKeyUp?(key: string): void;

  /** 重启时重置子类内部状态 */
  protected resetState(): void {
    for (const obj of this.beatmap.hitObjects) {
      obj.judged = false;
      obj.judgement = null;
      obj._sliderHit = false;
    }
    this.cursorX = -100;
    this.cursorY = -100;
    this.cursorTargetX = -100;
    this.cursorTargetY = -100;
  }

  public getScore(): ScoreState {
    return this.score;
  }
  public getStatus(): typeof this.status {
    return this.status;
  }
}
