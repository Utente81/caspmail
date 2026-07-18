document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.createElement("canvas");
  canvas.id = "particle-network";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "0",
    pointerEvents: "none",
    display: "block"
  });
  
  // Insert canvas at the very beginning of the body
  document.body.prepend(canvas);

  const PARTICLE_COUNT = 110;
  const MAX_DIST       = 160;
  const SPEED          = 0.35;
  const COLOR          = "14, 165, 233"; // #0ea5e9

  const ctx = canvas.getContext("2d");

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * SPEED,
    vy: (Math.random() - 0.5) * SPEED,
    r:  Math.random() * 1.5 + 1,
  }));

  let raf;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.4;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.lineWidth   = 0.7;
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COLOR}, 0.75)`;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = `rgba(${COLOR}, 0.9)`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    raf = requestAnimationFrame(draw);
  };

  draw();
});
