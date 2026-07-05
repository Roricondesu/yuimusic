/** osu!catch 引擎
 *  - 水平移动的"接水果"游戏
 *  - 水果从右向左移动到接住位置
 *  - 盘子在底部水平移动接住
 *
 *  这里把传统垂直下落改为水平移动，方便横屏游玩
 */
import type { HitObject, ParsedBeatmap } from "@/types";
import { GameEngine } from "../GameEngine";
import { drawCircle, drawRect, drawText, hexToRgba, clamp } from "../renderer/Canvas2D";

const APPROACH_TIME = 1500;
const FRUIT_R = 22;
const PLATE_HALF_W = 50;
const PLATE_H = 12;

export class CatchEngine extends GameEngine {
  private judgeX = 0;
  private cy = 0;
  private plateX = 0; // 当前盘子位置
  private targetX = 0; // 目标位置（鼠标/触摸控制）
  private leftHeld = false;
  private rightHeld = false;
  private lastTime = 0;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    audio: HTMLAudioElement;
    beatmap: ParsedBeatmap;
    offset?: number;
    callbacks?: import("../GameEngine").EngineCallbacks;
  }) {
    super(opts);
    this.cy = this.ctx.height - 60;
    this.judgeX = this.ctx.width * 0.18;
    this.plateX = this.judgeX;
    this.targetX = this.judgeX;
  }

  private fruitX(obj: HitObject, time: number): number {
    const dt = obj.time - time;
    return this.judgeX + dt / APPROACH_TIME * (this.ctx.width - this.judgeX);
  }

  protected update(time: number): void {
    const dt = time - this.lastTime;
    this.lastTime = time;

    // 盘子移动
    if (this.leftHeld || this.rightHeld) {
      const speed = 0.6; // px/ms
      const dir = (this.rightHeld ? 1 : 0) - (this.leftHeld ? 1 : 0);
      this.targetX = clamp(this.plateX + dir * speed * dt, 0, this.ctx.width);
    }
    this.plateX += (this.targetX - this.plateX) * 0.3;

    // 判定水果
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged) continue;
      const fx = this.fruitX(obj, time);
      // 水果到达判定线（X <= judgeX + 阈值）
      if (fx <= this.judgeX + FRUIT_R) {
        // 检查盘子是否接住
        const dist = Math.abs(fx - this.plateX);
        if (dist < PLATE_HALF_W + FRUIT_R * 0.5) {
          this.judgeHit(obj, time);
        } else if (fx < this.judgeX - FRUIT_R) {
          // 错过了
          obj.judged = true;
          obj.judgement = "miss";
          this.submitJudgement("miss");
        }
      }
    }
  }

  protected render(): void {
    this.clearScreen();
    const time = this.getCurrentTime();

    // 顶部轨道
    drawRect(this.ctx, 0, this.cy - FRUIT_R - 8, this.ctx.width, FRUIT_R * 2 + 16, "rgba(0,0,0,0.4)");
    // 判定线
    drawRect(this.ctx, this.judgeX - 2, 0, 4, this.ctx.height, "rgba(255,255,255,0.3)");

    // 绘制水果
    for (const obj of this.beatmap.hitObjects) {
      if (obj.judged && obj.judgement !== "miss") continue;
      const dt = obj.time - time;
      if (dt > APPROACH_TIME) continue;
      const x = this.fruitX(obj, time);
      if (x < -FRUIT_R) continue;

      // 不同 y 错位（模拟下落层级）
      const y = this.cy - (obj.y % 60) - 20;
      const color = obj.type === "slider" ? "#ff9100" : "#66cc44";
      drawCircle(this.ctx, x, y, FRUIT_R, color, "#fff", 2);
    }

    // 盘子
    drawRect(
      this.ctx,
      this.plateX - PLATE_HALF_W,
      this.cy + FRUIT_R - 4,
      PLATE_HALF_W * 2,
      PLATE_H,
      "#fff",
      PLATE_H / 2,
    );

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
      drawText(this.ctx, `${score.combo}x`, 16, 28, {
        font: "bold 18px system-ui",
        fillStyle: "#66cc44",
        align: "left",
      });
    }
  }

  public onPointerDown(x: number, _y: number): void {
    if (this.status !== "playing") return;
    this.targetX = clamp(x, 0, this.ctx.width);
  }

  public onPointerMove = (x: number, _y: number): void => {
    if (this.status !== "playing") return;
    this.targetX = clamp(x, 0, this.ctx.width);
  };

  public onPointerUp = (): void => {};

  public onKeyDown(key: string): void {
    const k = key.toLowerCase();
    if (k === "arrowleft" || k === "a") this.leftHeld = true;
    else if (k === "arrowright" || k === "d") this.rightHeld = true;
  }

  public onKeyUp = (key: string): void => {
    const k = key.toLowerCase();
    if (k === "arrowleft" || k === "a") this.leftHeld = false;
    else if (k === "arrowright" || k === "d") this.rightHeld = false;
  };
}
