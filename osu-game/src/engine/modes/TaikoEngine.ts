/** osu!taiko 引擎
 *  - 红（Don）和蓝（Katsu）音符从右向左移动
 *  - 到达判定圈时按对应键击中
 *  - 圈/长条两种类型
 */
import type { HitObject, ParsedBeatmap } from "@/types";
import { GameEngine } from "../GameEngine";
import { drawCircle, drawRect, drawText, hexToRgba } from "../renderer/Canvas2D";

const NOTE_R = 32;
const JUDGE_X_RATIO = 0.18; // 判定圈位置（屏幕宽度的 18%）
const APPROACH_TIME = 1500; // 音符提前 1.5s 出现

export class TaikoEngine extends GameEngine {
  private judgeX = 0;
  private cy = 0;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    audio: HTMLAudioElement;
    beatmap: ParsedBeatmap;
    offset?: number;
    callbacks?: import("../GameEngine").EngineCallbacks;
  }) {
    super(opts);
    this.cy = (this.ctx.height - 60) / 2 + 30;
    this.judgeX = this.ctx.width * JUDGE_X_RATIO;
  }

  private isBlue(obj: HitObject): boolean {
    // 用 hitSound 字段无法直接判断，简化：偶数时间 = 蓝，奇数时间 = 红
    // 真实 osu! 是按 hitSound 4 = 蓝
    // 这里用 newCombo 简化区分
    return !!obj.newCombo;
  }

  /** 音符当前 X 坐标（从右向左移动） */
  private noteX(obj: HitObject, time: number): number {
    const dt = obj.time - time;
    return this.judgeX + dt / APPROACH_TIME * (this.ctx.width - this.judgeX);
  }

  protected update(time: number): void {
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      // 超过判定窗口 → miss
      const delta = time - obj.time;
      if (delta > this.windows["50"]) {
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

    // 横向轨道
    drawRect(this.ctx, 0, this.cy - NOTE_R - 8, this.ctx.width, (NOTE_R + 8) * 2, "rgba(0,0,0,0.4)");

    // 判定圈
    drawRing2(ctx, this.judgeX, this.cy, NOTE_R + 6, "rgba(255,255,255,0.5)", 4);
    drawRing2(ctx, this.judgeX, this.cy, NOTE_R, "rgba(255,255,255,0.8)", 3);

    // 绘制可见音符
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged && obj.judgement !== "miss") continue;
      const dt = obj.time - time;
      if (dt > APPROACH_TIME) continue;
      if (dt < -300 && obj.judged) continue;

      const x = this.noteX(obj, time);
      const blue = this.isBlue(obj);

      if (obj.type === "slider" || obj.type === "hold") {
        // 长条音符
        const endX = this.noteX(
          { ...obj, time: obj.endTime || obj.time + 500 },
          time,
        );
        const minX = Math.min(x, endX);
        const maxX = Math.max(x, endX);
        drawRect(
          this.ctx,
          minX,
          this.cy - NOTE_R / 2,
          maxX - minX,
          NOTE_R,
          blue ? hexToRgba("#3aa3ff", 0.85) : hexToRgba("#ff5544", 0.85),
          NOTE_R / 2,
        );
        // 头尾圆
        drawCircle(this.ctx, x, this.cy, NOTE_R / 2, blue ? "#3aa3ff" : "#ff5544");
        drawCircle(this.ctx, endX, this.cy, NOTE_R / 2, blue ? "#3aa3ff" : "#ff5544");
      } else {
        drawCircle(
          this.ctx,
          x,
          this.cy,
          NOTE_R,
          blue ? "#3aa3ff" : "#ff5544",
          "#fff",
          3,
        );
        drawCircle(this.ctx, x, this.cy, NOTE_R * 0.4, "rgba(255,255,255,0.7)");
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
      drawText(this.ctx, `${score.combo}x`, this.judgeX, this.cy - NOTE_R - 24, {
        font: "bold 18px system-ui",
        fillStyle: "#ffaa00",
      });
    }
  }

  private tryHit(blue: boolean): void {
    if (this.status !== "playing") return;
    const time = this.getCurrentTime();
    let best: HitObject | null = null;
    let bestDelta = Infinity;
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      const delta = Math.abs(time - obj.time);
      if (delta > this.windows["50"]) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = obj;
      }
    }
    if (best) {
      // 颜色必须匹配，否则视为 miss（简化版放宽：颜色错也算 50）
      if (this.isBlue(best) === blue) {
        this.judgeHit(best, time);
      } else {
        best.judged = true;
        best.judgement = "miss";
        this.submitJudgement("miss");
      }
    }
  }

  public onPointerDown(x: number, _y: number): void {
    if (this.status !== "playing") return;
    // 左半屏 = 红（Don），右半屏 = 蓝（Katsu）
    const blue = x > this.ctx.width / 2;
    this.tryHit(blue);
  }

  public onPointerMove = (): void => {};
  public onPointerUp = (): void => {};

  public onKeyDown(key: string): void {
    const k = key.toLowerCase();
    if (k === "d" || k === "f") this.tryHit(false);
    else if (k === "k" || k === "j") this.tryHit(true);
  }

  public onKeyUp = (): void => {};
}

// 内联 ring 绘制（避免依赖导出）
const drawRing2 = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  strokeStyle: string,
  strokeWidth: number,
) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
};
