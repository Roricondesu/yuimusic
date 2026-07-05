/** osu!mania 引擎
 *  - 多列下落式键击游戏
 *  - 音符从顶部下落到判定线，到达时按对应键
 *  - 列数 = CircleSize（默认 4 列）
 */
import type { HitObject, ParsedBeatmap } from "@/types";
import { GameEngine } from "../GameEngine";
import { drawCircle, drawRect, drawText, hexToRgba } from "../renderer/Canvas2D";

const APPROACH_TIME = 1500; // 音符提前 1.5s 出现
const NOTE_H = 16;
const JUDGE_LINE_OFFSET = 80; // 距底部 80px
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

  constructor(opts: {
    canvas: HTMLCanvasElement;
    audio: HTMLAudioElement;
    beatmap: ParsedBeatmap;
    offset?: number;
    callbacks?: import("../GameEngine").EngineCallbacks;
  }) {
    super(opts);
    this.cols = Math.max(1, Math.round(opts.beatmap.cs));
    this.cols = Math.min(Math.max(this.cols, 1), 10);
    this.keyMap = KEY_MAP[this.cols] || KEY_MAP[4];
    this.computeLayout();
  }

  private computeLayout(): void {
    const { width, height } = this.ctx;
    // 列总宽：屏幕宽度的 50%，居中
    const totalW = Math.min(width * 0.6, 600);
    this.colWidth = totalW / this.cols;
    this.startX = (width - totalW) / 2;
    this.judgeY = height - JUDGE_LINE_OFFSET;
  }

  private colX(col: number): number {
    return this.startX + (col + 0.5) * this.colWidth;
  }

  private noteY(obj: HitObject, time: number): number {
    const dt = obj.time - time;
    return this.judgeY - dt / APPROACH_TIME * (this.judgeY - 20);
  }

  protected update(time: number): void {
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      const delta = time - obj.time;
      // miss 判定
      if (delta > this.windows["50"]) {
        // 长按音符需检查 release
        if (obj.type === "hold" && obj.endTime && time < obj.endTime) {
          // 还在 hold 中，不 miss
          continue;
        }
        obj.judged = true;
        obj.judgement = "miss";
        this.submitJudgement("miss");
      }
    }
  }

  protected render(): void {
    this.clearScreen();
    const time = this.getCurrentTime();
    const { ctx } = this.ctx;

    // 列底色
    for (let c = 0; c < this.cols; c++) {
      const x = this.colX(c) - this.colWidth / 2;
      drawRect(
        this.ctx,
        x,
        0,
        this.colWidth,
        this.judgeY,
        c % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
      );
      // 按下列高亮
      if (this.heldCols.has(c)) {
        drawRect(this.ctx, x, 0, this.colWidth, this.judgeY, hexToRgba("#9966ff", 0.18));
      }
    }

    // 判定线
    drawRect(this.ctx, this.startX, this.judgeY - 2, this.colWidth * this.cols, 4, "rgba(255,255,255,0.7)");

    // 绘制音符
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged && obj.judgement !== "miss") continue;
      const col = obj.column ?? 0;
      if (col < 0 || col >= this.cols) continue;
      const dt = obj.time - time;
      if (dt > APPROACH_TIME) continue;
      const y = this.noteY(obj, time);

      const x = this.colX(col) - this.colWidth / 2 + 4;
      const w = this.colWidth - 8;

      if (obj.type === "hold" && obj.endTime) {
        // 长按音符
        const endY = this.noteY({ ...obj, time: obj.endTime }, time);
        const minY = Math.min(y, endY);
        const h = Math.abs(endY - y);
        drawRect(this.ctx, x, minY, w, h, hexToRgba("#9966ff", 0.85), 6);
        drawRect(this.ctx, x, y - NOTE_H / 2, w, NOTE_H, "#fff", 4);
      } else {
        // 普通音符
        drawRect(this.ctx, x, y - NOTE_H / 2, w, NOTE_H, "#fff", 4);
      }
    }

    this.drawHUD();
  }

  private drawHUD(): void {
    const score = this.score;
    drawText(this.ctx, `${Math.round(score.score).toLocaleString()}`, this.ctx.width / 2, 28, {
      font: "bold 22px system-ui",
      fillStyle: "#fff",
    });
    drawText(this.ctx, `${score.accuracy.toFixed(2)}%`, this.ctx.width - 16, 28, {
      font: "600 14px system-ui",
      fillStyle: "rgba(255,255,255,0.7)",
      align: "right",
    });
    if (score.combo > 0) {
      drawText(this.ctx, `${score.combo}x`, this.startX - 16, this.judgeY, {
        font: "bold 24px system-ui",
        fillStyle: "#9966ff",
        align: "right",
      });
    }
  }

  private tryHit(col: number): void {
    if (this.status !== "playing") return;
    const time = this.getCurrentTime();
    let best: HitObject | null = null;
    let bestDelta = Infinity;
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      if ((obj.column ?? 0) !== col) continue;
      const delta = Math.abs(time - obj.time);
      if (delta > this.windows["50"]) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = obj;
      }
    }
    if (best) {
      this.judgeHit(best, time);
    }
  }

  public onPointerDown(x: number, _y: number): void {
    if (this.status !== "playing") return;
    // 找到点击的列
    const col = Math.floor((x - this.startX) / this.colWidth);
    if (col < 0 || col >= this.cols) return;
    this.heldCols.add(col);
    this.tryHit(col);
  }

  public onPointerMove = (): void => {};
  public onPointerUp = (x: number, _y: number): void => {
    const col = Math.floor((x - this.startX) / this.colWidth);
    this.heldCols.delete(col);
  };

  public onKeyDown(key: string): void {
    const k = key.toLowerCase();
    const idx = this.keyMap.indexOf(k);
    if (idx < 0) return;
    this.heldCols.add(idx);
    this.tryHit(idx);
  }

  public onKeyUp = (key: string): void => {
    const k = key.toLowerCase();
    const idx = this.keyMap.indexOf(k);
    if (idx >= 0) this.heldCols.delete(idx);
  };
}
