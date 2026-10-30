// A schematic route is shown only when both endpoints are known.
import {escapeHTML as esc} from './project-schema.js';
export function journeyRoute(project, t) {
  if (!project.origin?.trim() || !project.destination?.trim()) return '';
  project = {...project, origin: esc(project.origin), destination: esc(project.destination), transport: esc(project.transport)};
  return `<div class="journey-route route-framework" role="group" aria-label="${t('route')}">
    <div class="route-stops"><span><small>${t('home')}</small><span>${project.origin}</span></span><span><small>${t('destination')}</small>${project.destination}</span></div>
    <svg class="route-sketch" viewBox="0 0 900 180" role="img" aria-label="${project.origin} → ${project.destination}">
      <g class="sketch-ink"><path class="sketch-trail" d="M89 99C191 169 229 15 350 89S495 152 590 82S729 139 809 88"/>
      <path class="sketch-echo" d="M88 103C193 172 232 18 351 93S497 155 592 86S730 143 810 92"/>
      <g transform="translate(50 21) rotate(-4 35 35)"><path d="M0 30L34 2 70 31M8 28V76H60V26M14 76V36H56M29 76V51H43V76M3 80H68M16 44H23M46 44H53M45 10V0H55V19"/><path class="sketch-echo" d="M-2 33L35 5 73 34M12 31V78H63"/></g>
      <g transform="translate(783 16) rotate(4 25 35)"><path d="M25 77Q-12 37 5 13Q23 -8 44 13Q62 37 25 77ZM25 72L27 77"/><circle cx="25" cy="27" r="10"/><path class="sketch-echo" d="M29 76Q-7 37 9 14Q23 -4 42 14Q58 37 29 76"/></g></g>
      ${project.transport ? `<text class="route-transport" x="450" y="154" text-anchor="middle">${project.transport}</text>` : ''}
    </svg><p class="route-caption">${t('routeNote')}</p>
  </div>`;
}

export function playJourneyRoutes(host, entries, {project}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {finished: Promise.resolve(true), cancel() {}};
  let cancelled = false, settled = false, frame = 0, timer = 0, layer;
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const complete = value => {
    if (settled) return;
    settled = true; cancelled = true;
    cancelAnimationFrame(frame); clearTimeout(timer);
    layer?.remove(); host.classList.remove('route-playing');
    finish(value);
  };
  const start = () => {
    if (cancelled) return;
    const routes = entries.map(({project: journey}, index) => {
      if (!journey.originCoords || !journey.destinationCoords) return null;
      const from = project(journey.originCoords), to = project(journey.destinationCoords);
      if (![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite)) return null;
      const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
      const bend = Math.min(120, Math.max(35, distance * 0.22)) * (index % 2 ? -1 : 1);
      const cx = (from.x + to.x) / 2 - dy / (distance || 1) * bend;
      const cy = (from.y + to.y) / 2 + dx / (distance || 1) * bend;
      return {from, to, d: `M${from.x},${from.y} Q${cx},${cy} ${to.x},${to.y}`, color: /^#[\da-f]{6}$/i.test(journey.color) ? journey.color : '#a67d59'};
    }).filter(Boolean);
    if (!routes.length) { complete(true); return; }
    layer = document.createElement('div'); layer.className = 'journey-route-playback';
    layer.innerHTML = `<svg class="journey-route-svg" width="${host.clientWidth}" height="${host.clientHeight}" aria-hidden="true">${routes.map(route => `<path d="${route.d}" style="color:${route.color}"/><circle r="4" style="color:${route.color}"/>`).join('')}</svg>`;
    host.append(layer); host.classList.add('route-playing');
    const drawings = [...layer.querySelectorAll('path')].map((path, index) => {
      const length = path.getTotalLength(), dot = layer.querySelectorAll('circle')[index];
      path.style.strokeDasharray = `${length}`; path.style.strokeDashoffset = `${length}`;
      return {path, dot, length, route: routes[index], delay: index * 130};
    });
    const duration = 1500, started = performance.now();
    const tick = now => {
      if (cancelled) return;
      let done = true;
      for (const drawing of drawings) {
        const progress = Math.max(0, Math.min(1, (now - started - drawing.delay) / duration));
        const eased = 1 - Math.pow(1 - progress, 3), point = drawing.path.getPointAtLength(drawing.length * eased);
        drawing.path.style.strokeDashoffset = `${drawing.length * (1 - eased)}`;
        drawing.dot.setAttribute('cx', point.x); drawing.dot.setAttribute('cy', point.y);
        drawing.dot.style.opacity = progress > 0 && progress < 1 ? '1' : '0';
        if (progress < 1) done = false;
      }
      if (done) { layer.classList.add('route-playback-complete'); timer = setTimeout(() => complete(true), 260); }
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(start);
  return {finished, cancel: () => complete(false)};
}
