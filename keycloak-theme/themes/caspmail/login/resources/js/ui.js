(function () {
  'use strict';

  const PARTICLE_COUNT = 110;
  const MAX_DIST       = 160;
  const SPEED          = 0.35;
  const COLOR_R        = 14;
  const COLOR_G        = 165;
  const COLOR_B        = 233;

  /* ── Particle network on a FIXED canvas (covers full viewport) ── */
  function initParticles() {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100vw',
      height:        '100vh',
      zIndex:        '0',
      pointerEvents: 'none',
      display:       'block',
    });
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r:  Math.random() * 1.5 + 1,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.35;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},${alpha})`;
            ctx.lineWidth   = 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw glowing dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.shadowBlur  = 8;
        ctx.shadowColor = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},0.9)`;
        ctx.fillStyle   = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},0.75)`;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      requestAnimationFrame(draw);
    }

    draw();
  }

  /* ── CaspMail logo — fixed top-left of viewport ── */
  function injectLogo() {
    const logo = document.createElement('div');
    logo.textContent = 'CaspMail';
    Object.assign(logo.style, {
      position:      'fixed',
      top:           '32px',
      left:          '48px',
      fontSize:      '30px',
      fontWeight:    '800',
      color:         '#ffffff',
      letterSpacing: '-0.5px',
      zIndex:        '9999',
      fontFamily:    "'Outfit', sans-serif",
      textShadow:    '0 2px 12px rgba(14,165,233,0.6)',
      pointerEvents: 'none',
      userSelect:    'none',
    });
    document.body.appendChild(logo);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectLogo();
    initParticles();
  });

})();
