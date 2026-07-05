/** osu!standard 引擎
 *  - 圆圈：approach circle 从大到小，到达 hit time 时与本体重合
 *  - 滑条：圆圈沿曲线滑动 N 次
 *  - 转盘：按住后旋转
 *
 *  osu 坐标系 0-512 × 0-384，缩放到 Canvas
 */
import type { HitObject, ParsedBeatmap, Judgement } from "@/types";
import { GameEngine } from "../GameEngine";
import type { CanvasContext } from "../renderer/Canvas2D";
import { drawCircle, drawRing, drawText, hexToRgba, clamp } from "../renderer/Canvas2D";

const OSU_W = 512;
const OSU_H = 384;
const CIRCLE_BASE_R = 32; // osu 默认圆半径（受 CS 影响）

const arToPreempt = (ar: number): number => {
  if (ar < 5) return 1200 + 600 * (5 - ar) / 5;
  if (ar === 5) return 1200;
  return 1200 - 750 * (ar - 5) / 5;
};

const csToRadius = (cs: number): number => CIRCLE_BASE_R - 4 * cs / 10;

interface ActiveHit {
  obj: HitObject;
  // slider
  sliderT?: number; // 0-1 当前 slide 进度
  sliderReversed?: boolean;
  finished?: boolean;
}

export class StandardEngine extends GameEngine {
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private preempt = 1200;
  private r = CIRCLE_BASE_R;
  private activePointer: { x: number; y: number; t: number } | null = null;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    audio: HTMLAudioElement;
    beatmap: ParsedBeatmap;
    offset?: number;
    callbacks?: import("../GameEngine").EngineCallbacks;
  }) {
    super(opts);
    this.preempt = arToPreempt(opts.beatmap.ar);
    this.r = csToRadius(opts.beatmap.cs);
    this.computeLayout();
  }

  private computeLayout(): void {
    const { width, height } = this.ctx;
    // 留出顶部 HUD 空间
    const padTop = 60;
    const availH = height - padTop - 20;
    const availW = width - 40;
    this.scale = Math.min(availW / OSU_W, availH / OSU_H);
    this.offsetX = (width - OSU_W * this.scale) / 2;
    this.offsetY = padTop + (availH - OSU_H * this.scale) / 2;
  }

  private toCanvasX(x: number): number {
    return this.offsetX + x * this.scale;
  }
  private toCanvasY(y: number): number {
    return this.offsetY + y * this.scale;
  }
  private get radius(): number {
    return this.r * this.scale;
  }

  protected update(time: number): void {
    // 检查超时 miss
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      this.checkMiss(time, obj);
    }
  }

  protected render(): void {
    this.clearScreen();
    const time = this.getCurrentTime();
    const { ctx } = this.ctx;

    // 绘制可见的 hit objects（preempt 时间内的）
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged && obj.judgement !== "miss") {
        // 已击中的：绘制 hit 爆裂效果（简化为不绘制）
        continue;
      }
      const timeUntil = obj.time - time;
      if (timeUntil > this.preempt) continue; // 还没到出现时间
      if (time > (obj.endTime || obj.time) + 200 && obj.judged) continue;

      if (obj.type === "circle") {
        this.drawCircle(obj, time);
      } else if (obj.type === "slider") {
        this.drawSlider(obj, time);
      } else if (obj.type === "spinner") {
        this.drawSpinner(obj, time);
      }
    }

    // 绘制 HUD
    this.drawHUD();
  }

  private drawCircle(obj: HitObject, time: number): void {
    const x = this.toCanvasX(obj.x);
    const y = this.toCanvasY(obj.y);
    const r = this.radius;
    const timeUntil = obj.time - time;
    const approachT = clamp(1 - timeUntil / this.preempt, 0, 1);

    // 主体圆
    drawCircle(this.ctx, x, y, r, hexToRgba("#ff66aa", 0.85), "#fff", 3);
    // 中心编号（简化为点）
    drawCircle(this.ctx, x, y, r * 0.35, "rgba(255,255,255,0.6)");

    // approach circle（从 4x 缩到 1x）
    if (approachT < 1) {
      const ar = r * (4 - 3 * approachT);
      drawRing(this.ctx, x, y, ar, "rgba(255,255,255,0.85)", 3);
    }
  }

  private drawSlider(obj: HitObject, time: number): void {
    if (!obj.curvePoints || !obj.curvePoints.length) {
      this.drawCircle(obj, time);
      return;
    }
    const { ctx } = this.ctx;
    // 绘制曲线
    const pts = [{ x: obj.x, y: obj.y }, ...obj.curvePoints].map((p) => ({
      x: this.toCanvasX(p.x),
      y: this.toCanvasY(p.y),
    }));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineWidth = this.radius * 2;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineWidth = this.radius * 2 - 6;
    ctx.strokeStyle = hexToRgba("#ff66aa", 0.5);
    ctx.stroke();

    // 头部圆
    const headX = this.toCanvasX(obj.x);
    const headY = this.toCanvasY(obj.y);
    drawCircle(this.ctx, headX, headY, this.radius, hexToRgba("#ff66aa", 0.85), "#fff", 3);

    // slider 球（如果在滑动中）
    const dur = (obj.length || 0) / this.beatmap.sliderMultiplier * 1000 * obj.slides!;
    if (time >= obj.time && time <= obj.time + dur) {
      const t = ((time - obj.time) % (dur / obj.slides!)) / (dur / obj.slides!);
      const slideIdx = Math.floor((time - obj.time) / (dur / obj.slides!));
      const actualT = slideIdx % 2 === 0 ? t : 1 - t;
      const pos = this.evalSliderPos(pts, actualT);
      drawCircle(this.ctx, pos.x, pos.y, this.radius * 0.5, "#fff");
    }

    // approach circle（头部）
    const timeUntil = obj.time - time;
    if (timeUntil > 0) {
      const approachT = clamp(1 - timeUntil / this.preempt, 0, 1);
      if (approachT < 1) {
        const ar = this.radius * (4 - 3 * approachT);
        drawRing(this.ctx, headX, headY, ar, "rgba(255,255,255,0.85)", 3);
      }
    }
  }

  private evalSliderPos(pts: { x: number; y: number }[], t: number): { x: number; y: number } {
    if (pts.length === 1) return pts[0];
    const totalLen = pts.reduce((sum, p, i) => i === 0 ? 0 : sum + Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y), 0);
    let target = totalLen * t;
    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
      if (target <= segLen) {
        const k = segLen === 0 ? 0 : target / segLen;
        return {
          x: pts[i-1].x + (pts[i].x - pts[i-1].x) * k,
          y: pts[i-1].y + (pts[i].y - pts[i-1].y) * k,
        };
      }
      target -= segLen;
    }
    return pts[pts.length - 1];
  }

  private drawSpinner(obj: HitObject, time: number): void {
    const cx = this.ctx.width / 2;
    const cy = this.offsetY + OSU_H * this.scale / 2;
    const r = Math.min(this.ctx.width, this.ctx.height) * 0.3;

    // 中心圆环
    drawRing(this.ctx, cx, cy, r, "rgba(255,255,255,0.3)", 4);
    drawRing(this.ctx, cx, cy, r * 0.7, "rgba(255,255,255,0.2)", 2);

    // 进度
    const start = obj.time;
    const end = obj.endTime || obj.time;
    if (time >= start && time <= end) {
      const progress = (time - start) / (end - start);
      // 旋转标记
      const angle = progress * Math.PI * 8;
      const { ctx } = this.ctx;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = "#ff66aa";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, 0);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#ff66aa";
      ctx.stroke();
      ctx.restore();
    }

    drawText(this.ctx, "SPIN", cx, cy, {
      font: "bold 20px system-ui",
      fillStyle: "rgba(255,255,255,0.5)",
    });
  }

  private drawHUD(): void {
    const score = this.score;
    const { width } = this.ctx;
    // 顶部：分数 / 准确率 / 连击
    drawText(this.ctx, `${Math.round(score.score).toLocaleString()}`, width / 2, 28, {
      font: "bold 22px system-ui",
      fillStyle: "#fff",
      align: "center",
    });
    drawText(this.ctx, `${score.accuracy.toFixed(2)}%`, width - 16, 28, {
      font: "600 14px system-ui",
      fillStyle: "rgba(255,255,255,0.7)",
      align: "right",
    });
    if (score.combo > 0) {
      drawText(this.ctx, `${score.combo}x`, 16, 28, {
        font: "bold 18px system-ui",
        fillStyle: "var(--accent)",
        align: "left",
      });
    }
  }

  public onPointerDown(x: number, y: number): void {
    if (this.status !== "playing") return;
    const time = this.getCurrentTime();
    // 查找最近的未判定 circle/slider
    let best: HitObject | null = null;
    let bestDelta = Infinity;
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      if (obj.type === "spinner") continue;
      const dx = this.toCanvasX(obj.x) - x;
      const dy = this.toCanvasY(obj.y) - y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.radius * 1.5) continue;
      const delta = Math.abs(time - obj.time);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = obj;
      }
    }
    if (best) {
      this.judgeHit(best, time);
    }
  }

  public onPointerMove = (x: number, y: number): void => {
    this.activePointer = { x, y, t: this.getCurrentTime() };
  };

  public onPointerUp = (): void => {
    this.activePointer = null;
  };

  public onKeyDown(key: string): void {
    // 桌面端：X / 鼠标点击都触发判定，这里复用 pointerDown 逻辑
    if (key === "x" || key === "X") {
      // 取屏幕中心点击
      this.onPointerDown(this.ctx.width / 2, this.ctx.height / 2);
    }
  }

  public onKeyUp = (): void => {};
}
