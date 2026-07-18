document.addEventListener("DOMContentLoaded", () => {
  // Attach everything to .login-pf-page so it's safely inside the main layout
  const container = document.querySelector('.login-pf-page') || document.body;
  
  // 1. Add CaspMail Logo in Top Left
  const logo = document.createElement("div");
  logo.textContent = "CaspMail";
  Object.assign(logo.style, {
    position: "absolute",
    top: "32px",
    left: "48px",
    fontSize: "32px",
    fontWeight: "800",
    color: "#fff",
    letterSpacing: "-1px",
    zIndex: "9999",
    fontFamily: "'Outfit', sans-serif",
    textShadow: "0 2px 10px rgba(14,165,233,0.5)"
  });
  container.appendChild(logo);

  // 2. Add Stars background
  const starsLayer = document.createElement("div");
  starsLayer.className = "stars-layer";
  
  for (let i = 0; i < 60; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size = Math.random() * 3 + 1; // 1-4px
    Object.assign(star.style, {
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${Math.random() * 6}s`,
      opacity: Math.random() * 0.6 + 0.4,
    });
    starsLayer.appendChild(star);
  }
  
  container.prepend(starsLayer);
});
