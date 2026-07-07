/** osu!mania 引擎
 *  - 多列下落式键击游戏
 *  - 音符从顶部下落到判定线，到达时按对应键
 *  - 列数 = CircleSize（默认 4 列）
 */
import type { HitObject, ParsedBeatmap } from "@/types";
import { GameEngine, type EngineCallbacks } from "../GameEngine";
import { drawRect, drawText, GAME_FONT, hexToRgba, clamp } from "../renderer/Canvas2D";

const APPROACH_TIME = 1500; // 音符提前 1.5s 出现
const NOTE_H = 16;
const JUDGE_LINE_OFFSET = 80; // 距底部 80px
const AUTO_WINDOW = 300; // 自动模式击打窗口 ±300ms
const KEY_MAP: Record<number, string[]> = {
  1: ["d"],
  2: ["f", "j"],
  3: ["f", " ", "j"],
  4: ["d", "f", "j", "k"],
  5: ["d", "f", " ", "j", "k"],
  6: ["s", "d", "f", "j", "k", "l"],
  7: ["s", "d", "f", " ", "j", "k", "l"],
  8: ["a", "s", "d", "f", "j", "k", "l", ";"],
  9: ["a", "s", "d", "f", " ", "j", "k", "l", ";"],
  10: ["a", "s", "d", "f", "v", "n", "j", "k", "l", ";"],
};

export class ManiaEngine extends GameEngine {
  private cols = 4;
  private colWidth = 0;
  private startX = 0;
  private judgeY = 0;
  private heldCols: Set<number> = new Set();
  private keyMap: string[] = [];
  /** 当前正在长按的音符：列 -> 物件 */
  private holding: Map<number, HitObject> = new Map();

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
    super(opts);
    this.cols = clamp(Math.round(opts.beatmap.cs), 1, 10);
    this.keyMap = KEY_MAP[this.cols] || KEY_MAP[4];
    this.computeLayout();
  }

  protected onLayoutChange(): void {
    this.computeLayout();
  }

  protected resetState(): void {
    super.resetState();
    this.heldCols.clear();
    this.holding.clear();
    this.computeLayout();
  }

  private computeLayout(): void {
    const { width, height } = this.ctx;
    // 列总宽：屏幕宽度的 60%，居中，最大 600px
    const totalW = Math.min(width * 0.6, 600);
    this.colWidth = totalW / this.cols;
    this.startX = (width - totalW) / 2;
    this.judgeY = height - JUDGE_LINE_OFFSET;
  }

  private colX(col: number): number {
    return this.startX + (col + 0.5) * this.colWidth;
  }

  private noteY(noteTime: number, time: number): number {
    const dt = noteTime - time;
    return this.judgeY - (dt / APPROACH_TIME) * (this.judgeY - 20);
  }

  private isHolding(obj: HitObject): boolean {
    for (const held of this.holding.values()) {
      if (held === obj) return true;
    }
    return false;
  }

  protected update(time: number): void {
    this.advanceActiveIndex(time);

    // 自动模式：每帧先清空 heldCols，避免列光效卡住
    if (this.auto) {
      this.heldCols.clear();
      this.autoPlay(time);
    }

    // 处理长按音符：保持按住状态，到 endTime 判定 300
    const completed: number[] = [];
    for (const [col, obj] of this.holding.entries()) {
      if (!obj.endTime) continue;
      this.heldCols.add(col);
      if (time >= obj.endTime) {
        completed.push(col);
      }
    }
    for (const col of completed) {
      const obj = this.holding.get(col);
      if (!obj || !obj.endTime) continue;
      const j = this.judgeHit(obj, obj.endTime);
      this.spawnHitEffect(this.colX(col), this.judgeY, j, time);
      this.holding.delete(col);
    }

    // 超时未处理 / 提前释放 → miss
    for (let i = this.activeIndex; i < this.beatmap.hitObjects.length; i++) {
      const obj = this.beatmap.hitObjects[i];
      if (obj.judged) continue;

      if (obj.type === "hold" && obj.endTime) {
        if (this.isHolding(obj)) continue;
        if (time > obj.time + this.windows["50"]) {
          this.missObject(obj, time);
        }
      } else {
        if (time - obj.time > this.windows["50"]) {
          this.missObject(obj, time);
        }
      }
    }

    this.pruneHitEffects(time);
  }

  private autoPlay(time: number): void {
    for (let col = 0; col < this.cols; col++) {
      // 保持正在长按的列发光
      const heldObj = this.holding.get(col);
      if (heldObj && heldObj.endTime && time < heldObj.endTime) {
        this.heldCols.add(col);
        continue;
      }

      let best: HitObject | null = null;
      let bestDelta = Infinity;

      for (const obj of this.beatmap.hitObjects) {
        if (obj.judged) continue;
        if ((obj.column ?? 0) !== col) continue;
        if (this.isHolding(obj)) continue;

        const delta = Math.abs(time - obj.time);
        if (delta > AUTO_WINDOW) continue;
        if (delta < bestDelta) {
          bestDelta = delta;
          best = obj;
        }
      }

      if (best) {
        this.tryHit(col, time, AUTO_WINDOW);
        this.cursorTargetX = this.colX(col);
        this.cursorTargetY = this.judgeY - 40;
      }
    }
  }

  private tryHit(col: number, time: number, windowMs: number): void {
    let best: HitObject | null = null;
    let bestDelta = Infinity;

    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      if ((obj.column ?? 0) !== col) continue;
      if (this.isHolding(obj)) continue;

      const delta = Math.abs(time - obj.time);
      if (delta > windowMs) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = obj;
      }
    }

    if (!best) return;

    if (best.type === "hold" && best.endTime) {
      this.holding.set(col, best);
      this.heldCols.add(col);
    } else {
      const j = this.judgeHit(best, time);
      this.spawnHitEffect(this.colX(col), this.judgeY, j, time);
    }
  }

  private releaseHold(col: number, time: number): void {
    const obj = this.holding.get(col);
    if (!obj) return;

    this.holding.delete(col);
    this.heldCols.delete(col);

    if (obj.judged) return;

    if (obj.endTime && time >= obj.endTime) {
      const j = this.judgeHit(obj, obj.endTime);
      this.spawnHitEffect(this.colX(col), this.judgeY, j, time);
    } else {
      this.missObject(obj, time);
    }
  }

  private missObject(obj: HitObject, time: number): void {
    if (obj.judged) return;
    obj.judged = true;
    obj.judgement = "miss";
    this.submitJudgement("miss");
    this.spawnJudgePopup("miss", 0, 0, time);
  }

  protected render(): void {
    this.clearScreen();
    const time = this.getCurrentTime();

    this.drawColumns();
    this.drawJudgeLine();
    this.drawNotes(time);
    this.drawHitEffects(time);
    this.drawJudgePopups(time);
    this.drawKeyPanel();
    this.drawHUD({ modeLabel: "osu!mania", modeColor: "#a78bfa" });
  }

  private drawColumns(): void {
    for (let c = 0; c < this.cols; c++) {
      const x = this.colX(c) - this.colWidth / 2;
      // 纯色列背景
      drawRect(
        this.ctx,
        x,
        0,
        this.colWidth,
        this.judgeY,
        c % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
      );
      // 按下时列发光（扁平）
      if (this.heldCols.has(c)) {
        drawRect(this.ctx, x, 0, this.colWidth, this.judgeY, hexToRgba("#a78bfa", 0.18));
      }
    }
  }

  private drawJudgeLine(): void {
    drawRect(this.ctx, this.startX, this.judgeY - 2, this.colWidth * this.cols, 4, "rgba(255,255,255,0.7)");
  }

  private drawNotes(time: number): void {
    const H = this.ctx.height;

    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged && obj.judgement !== "miss") continue;

      const col = obj.column ?? 0;
      if (col < 0 || col >= this.cols) continue;

      const dt = obj.time - time;
      if (dt > APPROACH_TIME) continue;

      const y = this.noteY(obj.time, time);

      // 已越过判定线或完全超出屏幕下方则跳过
      if (y > H + 70) break;
      if (obj.type !== "hold" && y > this.judgeY + NOTE_H) continue;

      const x = this.colX(col) - this.colWidth / 2 + 4;
      const w = this.colWidth - 8;

      if (obj.type === "hold" && obj.endTime) {
        const endY = this.noteY(obj.endTime, time);
        if (Math.min(y, endY) > H + 70) continue;
        if (Math.max(y, endY) < -70) continue;

        const minY = Math.min(y, endY);
        const h = Math.abs(endY - y);
        // 长按体
        drawRect(this.ctx, x, minY, w, h, hexToRgba("#a78bfa", 0.75), 6);
        // 头
        drawRect(this.ctx, x, y - NOTE_H / 2, w, NOTE_H, "#fff", 4);
        // 尾
        drawRect(this.ctx, x, endY - NOTE_H / 2, w, NOTE_H, "#fff", 4);
      } else {
        // 普通音符：纯色圆角矩形
        drawRect(this.ctx, x, y - NOTE_H / 2, w, NOTE_H, "#fff", 4);
      }
    }
  }

  private drawKeyPanel(): void {
    const { ctx } = this.ctx;
    const panelH = 44;
    const y = this.ctx.height - panelH;
    const totalW = this.colWidth * this.cols;

    ctx.save();
    // 半透明填充
    ctx.fillStyle = "rgba(20,20,30,0.45)";
    ctx.fillRect(this.startX, y, totalW, panelH);
    // 边框
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.startX + 0.5, y + 0.5, totalW - 1, panelH - 1);
    // 顶部微光
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(this.startX, y, totalW, 1);
    ctx.restore();

    // 按键提示
    for (let c = 0; c < this.cols; c++) {
      const label = this.keyMap[c]?.toUpperCase() ?? "";
      drawText(this.ctx, label, this.colX(c), y + panelH / 2, {
        font: `700 12px ${GAME_FONT}`,
        fillStyle: "rgba(255,255,255,0.65)",
        align: "center",
        baseline: "middle",
      });
    }
  }

  private colFromX(x: number): number {
    return Math.floor((x - this.startX) / this.colWidth);
  }

  public onPointerDown(x: number, _y: number): void {
    if (this.status !== "playing" || this.auto) return;
    const col = this.colFromX(x);
    if (col < 0 || col >= this.cols) return;
    this.heldCols.add(col);
    this.tryHit(col, this.getCurrentTime(), this.windows["50"]);
  }

  public onPointerMove = (): void => {};

  public onPointerUp = (x: number, _y: number): void => {
    if (this.auto) return;
    const col = this.colFromX(x);
    if (col < 0 || col >= this.cols) return;
    this.heldCols.delete(col);
    this.releaseHold(col, this.getCurrentTime());
  };

  public onKeyDown(key: string): void {
    if (this.status !== "playing" || this.auto) return;
    const k = key.toLowerCase();
    const idx = this.keyMap.indexOf(k);
    if (idx < 0) return;
    this.heldCols.add(idx);
    this.tryHit(idx, this.getCurrentTime(), this.windows["50"]);
  }

  public onKeyUp = (key: string): void => {
    if (this.auto) return;
    const k = key.toLowerCase();
    const idx = this.keyMap.indexOf(k);
    if (idx < 0) return;
    this.heldCols.delete(idx);
    this.releaseHold(idx, this.getCurrentTime());
  };
}
