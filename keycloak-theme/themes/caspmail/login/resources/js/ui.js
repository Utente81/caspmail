document.addEventListener("DOMContentLoaded", () => {
  // Add CaspMail Logo
  const logo = document.createElement("div");
  logo.textContent = "CaspMail";
  Object.assign(logo.style, {
    position: "absolute",
    top: "32px",
    left: "48px",
    fontSize: "28px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-1px",
    zIndex: "100",
    fontFamily: "'Outfit', sans-serif"
  });
  document.body.appendChild(logo);

  // Add stars background layer
  const starsLayer = document.createElement("div");
  starsLayer.className = "stars-layer";
  
  for (let i = 0; i < 40; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size = Math.random() * 3 + 2; // 2–5px
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
  
  document.body.prepend(starsLayer);
});
