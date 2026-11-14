import { useEffect, useRef } from 'react';

/**
 * CosmicBackground - Animated Purple Cosmic Waves / Silk Ribbons
 * Replicates the fluid, organic undulating purple silk ribbons from Image 1.
 * High performance canvas animation with smooth harmonics and soft radial glows.
 */
export function CosmicBackground() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Wave ribbon parameters
    const waves = [
      {
        baseY: 0.52,
        amplitude: 65,
        speed: 0.0008,
        wavelength: 0.0032,
        color1: 'rgba(147, 51, 234, 0.45)', // purple-600
        color2: 'rgba(79, 70, 229, 0.25)',  // indigo-600
        glow: 'rgba(168, 85, 247, 0.25)',
        phase: 0,
      },
      {
        baseY: 0.48,
        amplitude: 85,
        speed: 0.0006,
        wavelength: 0.0022,
        color1: 'rgba(168, 85, 247, 0.55)', // purple-500
        color2: 'rgba(124, 58, 237, 0.35)', // violet-600
        glow: 'rgba(192, 132, 252, 0.3)',
        phase: 1.8,
      },
      {
        baseY: 0.56,
        amplitude: 50,
        speed: 0.0011,
        wavelength: 0.0042,
        color1: 'rgba(192, 132, 252, 0.35)', // purple-400
        color2: 'rgba(147, 51, 234, 0.15)',
        glow: 'rgba(216, 180, 254, 0.2)',
        phase: 3.5,
      },
      {
        baseY: 0.44,
        amplitude: 95,
        speed: 0.0005,
        wavelength: 0.0018,
        color1: 'rgba(126, 34, 206, 0.35)', // purple-700
        color2: 'rgba(59, 130, 246, 0.15)',
        glow: 'rgba(147, 51, 234, 0.2)',
        phase: 4.8,
      },
    ];

    // Subtle floating cosmic stars/particles
    const particles = Array.from({ length: 32 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: (Math.random() - 0.5) * 0.2,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    let startTime = performance.now();

    const render = (now) => {
      animFrameRef.current = requestAnimationFrame(render);
      const elapsed = now - startTime;

      // Dark Cosmic Deep Background
      ctx.fillStyle = '#06040C';
      ctx.fillRect(0, 0, width, height);

      // Ambient radial spotlight in the center
      const centerGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        10,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.65
      );
      centerGrad.addColorStop(0, 'rgba(38, 16, 68, 0.6)');
      centerGrad.addColorStop(0.5, 'rgba(15, 8, 30, 0.7)');
      centerGrad.addColorStop(1, 'rgba(6, 4, 12, 1)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);

      // Render subtle stardust
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(192, 132, 252, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw undulating silk waves
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const timeOffset = elapsed * w.speed;
        const cy = height * w.baseY;

        ctx.beginPath();
        ctx.moveTo(0, cy);

        // Compute smooth wave points across the screen width
        const points = [];
        const step = 20;
        for (let x = 0; x <= width + step; x += step) {
          const y =
            cy +
            Math.sin(x * w.wavelength + timeOffset + w.phase) * w.amplitude +
            Math.cos(x * w.wavelength * 0.6 - timeOffset * 0.8) * (w.amplitude * 0.4);
          points.push({ x, y });
        }

        // Draw smooth cubic curves through points
        for (let p = 0; p < points.length - 1; p++) {
          const xc = (points[p].x + points[p + 1].x) / 2;
          const yc = (points[p].y + points[p + 1].y) / 2;
          ctx.quadraticCurveTo(points[p].x, points[p].y, xc, yc);
        }

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        // Silk ribbon gradient
        const waveGrad = ctx.createLinearGradient(0, cy - w.amplitude, width, cy + w.amplitude * 2);
        waveGrad.addColorStop(0, w.color1);
        waveGrad.addColorStop(0.5, w.color2);
        waveGrad.addColorStop(1, 'rgba(10, 5, 20, 0.05)');

        ctx.fillStyle = waveGrad;
        ctx.fill();

        // Luminous highlight edge
        ctx.strokeStyle = w.glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let p = 0; p < points.length - 1; p++) {
          const xc = (points[p].x + points[p + 1].x) / 2;
          const yc = (points[p].y + points[p + 1].y) / 2;
          if (p === 0) ctx.moveTo(points[p].x, points[p].y);
          ctx.quadraticCurveTo(points[p].x, points[p].y, xc, yc);
        }
        ctx.stroke();
      }

      ctx.restore();
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Subtle vignette layer */}
      <div className="absolute inset-0 bg-radial-vignette opacity-70 pointer-events-none" />
    </div>
  );
}

