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
