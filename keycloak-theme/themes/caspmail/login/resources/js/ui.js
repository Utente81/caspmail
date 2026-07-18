(function () {
  const PARTICLE_COUNT = 110;
  const MAX_DIST       = 160;
  const SPEED          = 0.35;
  const COLOR          = '14, 165, 233';

  function initCanvas(container) {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'none',
      display: 'block',
    });
    container.prepend(canvas);

    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = container.clientWidth  || window.innerWidth;
      canvas.height = container.clientHeight || window.innerHeight;
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

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      // Lines between nearby particles
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

      // Draw glowing dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(${COLOR}, 0.75)`;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = `rgba(${COLOR}, 0.9)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.login-pf-page') || document.body;
    
    // Ensure the container has relative positioning so canvas and logo are correctly positioned
    if (container.style.position !== 'absolute' && container.style.position !== 'fixed') {
      container.style.position = 'relative';
    }

    // 1. CaspMail logo — top left of the page
    const logo = document.createElement('div');
    logo.textContent = 'CaspMail';
    Object.assign(logo.style, {
      position:     'absolute',
      top:          '32px',
      left:         '48px',
      fontSize:     '32px',
      fontWeight:   '800',
      color:        '#fff',
      letterSpacing: '-1px',
      zIndex:       '9999',
      fontFamily:   "'Outfit', sans-serif",
      textShadow:   '0 2px 10px rgba(14,165,233,0.5)',
      pointerEvents: 'none',
    });
    container.appendChild(logo);

    // 2. Particle network canvas
    initCanvas(container);
  });
})();
