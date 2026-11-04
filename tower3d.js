/* Corner Office - pure CSS 3D tower: drag to rotate, elevator rides, window lights. */
(function () {
  const towerEl = () => document.getElementById('tower');
  const sceneWrap = () => document.getElementById('scene-wrap');
  let rotY = -32, rotX = 0; // rotX as extra perspective-origin shift
  let floors = []; // { index, el, floor }
  let onFloorClick = () => {};

  const FLOOR_H = 76; // keep in sync with --floor-h

  function build(floorData) {
    const t = towerEl();
    t.querySelectorAll('.floor, .ground').forEach(e => e.remove());
    floors = [];
    floorData.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'floor' + (f.active ? ' lit' : '');
      el.dataset.index = i;
      el.style.bottom = `${i * FLOOR_H}px`;
      const wins = '<div class="windows">' + '<i></i>'.repeat(12) + '</div>';
      el.innerHTML = `
        <div class="floor-sign">${escapeHtml(f.name)}</div>
        <div class="face front">${wins}</div>
        <div class="face back">${wins}</div>
        <div class="face left">${wins}</div>
        <div class="face right">${wins}</div>
        <div class="face roof"></div>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); rideElevator(i); onFloorClick(f, i); });
      t.appendChild(el);
      floors.push({ index: i, el, floor: f });
    });
    const g = document.createElement('div');
    g.className = 'ground';
    t.appendChild(g);
    apply();
  }

  function apply() {
    const scale = Math.min(1, (sceneWrap().clientHeight - 170) / Math.max(1, floors.length * FLOOR_H), (sceneWrap().clientWidth - 30) / 410);
    towerEl().style.transform = `scale(${scale}) rotateY(${rotY}deg)`;
    document.getElementById('scene').style.perspectiveOrigin = `50% ${30 + rotX}%`;
  }

  function rideElevator(floorIndex) {
    const car = document.querySelector('#elevator .elev-car');
    if (car) car.style.bottom = `${floorIndex * FLOOR_H + 6}px`;
  }

  function setWorking(i, on) {
    const f = floors[i];
    if (f) f.el.classList.toggle('working', !!on);
  }

  function setLit(i, on) {
    const f = floors[i];
    if (f) f.el.classList.toggle('lit', !!on);
  }

  function select(i) {
    floors.forEach(f => f.el.classList.toggle('selected', f.index === i));
  }

  // drag to rotate
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  function bind() {
    const wrap = sceneWrap();
    wrap.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      rotY += dx * 0.35;
      rotX = Math.max(-10, Math.min(18, rotX + dy * 0.1));
      lastX = e.clientX; lastY = e.clientY;
      apply();
    });
    wrap.addEventListener('pointerup', () => { dragging = false; });
    // gentle idle spin until first interaction
    let idle = true, idleRAF;
    const idleSpin = () => { if (!idle) return; rotY += 0.06; apply(); idleRAF = requestAnimationFrame(idleSpin); };
    idleRAF = requestAnimationFrame(idleSpin);
    wrap.addEventListener('pointerdown', () => { idle = false; cancelAnimationFrame(idleRAF); }, { once: true });
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  window.Tower3D = {
    bind, build, rideElevator, setWorking, setLit, select,
    onFloorClick: (fn) => { onFloorClick = fn; },
  };
})();
