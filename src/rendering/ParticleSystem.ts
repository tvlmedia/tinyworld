import { Point } from "../utils/MathUtils";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  emit(position: Point, color: string, count: number): void {
    for (let index = 0; index < count; index += 1) {
      if (this.particles.length > 260) break;
      this.particles.push({
        x: position.x,
        y: position.y,
        vx: Math.random() * 2 - 1,
        vy: Math.random() * -1.5,
        life: 0.8,
        maxLife: 0.8,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  update(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt * 18;
      particle.y += particle.vy * dt * 18;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }
}
