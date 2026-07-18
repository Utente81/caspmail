(function () {
  'use strict';

  const PARTICLE_COUNT = 110;
  const MAX_DIST       = 160;
  const SPEED          = 0.35;
  const COLOR_R        = 14;
  const COLOR_G        = 165;
  const COLOR_B        = 233;

  /* ── 1. Starry Background (Twinkling Stars) ── */
  function initStars() {
    if (document.getElementById('caspmail-stars')) return;
    const starsLayer = document.createElement('div');
    starsLayer.id = 'caspmail-stars';
    Object.assign(starsLayer.style, {
      position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      width: '100vw', height: '100vh',
      zIndex: '1', // Absolute back, behind particles (-1) and page (10)
      pointerEvents: 'none',
      overflow: 'hidden'
    });
    
    // Add 40 stars
    for (let i = 0; i < 40; i++) {
      const star = document.createElement('div');
      const size = Math.random() * 3 + 2; // 2-5px
      Object.assign(star.style, {
        position: 'absolute',
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDelay: `${Math.random() * 6}s`,
        opacity: Math.random() * 0.6 + 0.4,
      });
      // Assing animation class
      star.className = `star star-${(i % 4) + 1}`;
      starsLayer.appendChild(star);
    }
    
    document.body.prepend(starsLayer);
  }

  /* ── 2. Particle network on a FIXED canvas ── */
  function initParticles() {
    if (document.getElementById('caspmail-particles')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'caspmail-particles';
    Object.assign(canvas.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100vw',
      height:        '100vh',
      zIndex:        '2', // Above stars, under card
      pointerEvents: 'none',
      display:       'block',
      background:    'transparent'
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
            ctx.strokeStyle = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},${alpha})`;
            ctx.lineWidth   = 0.8;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.shadowBlur  = 8;
        ctx.shadowColor = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},0.9)`;
        ctx.fillStyle   = `rgba(${COLOR_R},${COLOR_G},${COLOR_B},0.85)`;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      requestAnimationFrame(draw);
    }

    draw();
  }

  /* ── 3. CaspMail logo ── */
  function injectLogo() {
    if (document.getElementById('caspmail-logo')) return;
    
    const logo = document.createElement('div');
    logo.id = 'caspmail-logo';
    logo.textContent = 'CaspMail';
    Object.assign(logo.style, {
      position:      'fixed',
      top:           '32px',
      left:          '48px',
      fontSize:      '32px',
      fontWeight:    '800',
      color:         '#ffffff',
      letterSpacing: '-1px',
      zIndex:        '9999',
      fontFamily:    "'Outfit', sans-serif",
      textShadow:    '0 2px 12px rgba(14,165,233,0.7)',
      pointerEvents: 'none',
      userSelect:    'none',
    });
    document.body.appendChild(logo);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectLogo();
    initStars();
    initParticles();
  });

})();
