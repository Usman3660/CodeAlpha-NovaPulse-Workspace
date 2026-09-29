// ==========================================================================
// 3D Card Tilt Physics & Specular Shine Engine
// ==========================================================================

class CardTilt3D {
  static attach(element, options = {}) {
    if (!element || element.dataset.tiltInitialized) return;
    element.dataset.tiltInitialized = 'true';

    const maxTilt = options.maxTilt || 14;
    const perspective = options.perspective || 1000;
    const scale = options.scale || 1.025;

    let bounds = null;

    function updateBounds() {
      bounds = element.getBoundingClientRect();
    }

    function onMouseEnter() {
      updateBounds();
      element.style.transition = 'transform 0.1s ease-out, box-shadow 0.2s ease-out';
    }

    function onMouseMove(e) {
      if (!bounds) updateBounds();
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;

      const percentX = (mouseX / bounds.width) * 2 - 1;
      const percentY = (mouseY / bounds.height) * 2 - 1;

      const rotateY = percentX * maxTilt;
      const rotateX = -percentY * maxTilt;

      element.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;

      // Update CSS variables for radial specular shine highlight
      element.style.setProperty('--mouse-x', `${(mouseX / bounds.width) * 100}%`);
      element.style.setProperty('--mouse-y', `${(mouseY / bounds.height) * 100}%`);
    }

    function onMouseLeave() {
      element.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease';
      element.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      bounds = null;
    }

    element.addEventListener('mouseenter', onMouseEnter);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseleave', onMouseLeave);
  }

  static applyAll(selector = '.task-card') {
    document.querySelectorAll(selector).forEach((el) => {
      CardTilt3D.attach(el);
    });
  }
}

window.CardTilt3D = CardTilt3D;
