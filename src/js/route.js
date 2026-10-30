// A small illustrated travel diary, drawn as paths so it stays sharp at any size.
export function journeyRoute(project, t) {
  return `<div class="journey-route" role="group" aria-label="${t('route')}: ${project.origin} → ${project.destination}">
    <div class="route-stops"><span><small>${t('home')}</small>${project.origin}</span><span><small>${t('destination')}</small>${project.destination}</span><span><small>${t('inField')}</small>${t('observe')}</span></div>
    <svg class="route-sketch" viewBox="0 0 900 200" role="img" aria-label="${t('transport')} → ${t('onFoot')}">
      <g class="sketch-ink"><path class="sketch-trail" d="M66 121C146 191 219 47 323 115S456 163 482 114S578 57 660 111S753 170 829 106"/>
      <path class="sketch-echo" d="M67 125C148 194 216 51 325 119S458 164 485 117S578 61 659 115S754 172 831 110"/>
      <g transform="translate(32 50) rotate(-4 35 35)"><path d="M0 30L34 2 70 31M8 28V76H60V26M14 76V36H56M29 76V51H43V76M3 80H68M16 44H23M46 44H53M45 10V0H55V19"/><path class="sketch-echo" d="M-2 33L35 5 73 34M12 31V78H63"/></g>
      <g transform="translate(221 32) rotate(-5 35 32)"><path d="M3 12Q32 -1 64 12L68 55H0ZM9 17H24V34H8ZM31 15H48V32H31ZM55 19L59 34M4 44H63M7 57L1 70M60 57L67 70M-1 68H69M17 57V64M50 57V64"/><circle cx="14" cy="47" r="2"/><circle cx="53" cy="47" r="2"/><path d="M-6 77H75M-1 83H68"/></g>
      <g transform="translate(424 37) rotate(3 35 35)"><path d="M0 89L15 30 36 18 52 31 68 89M10 89V48H59V89M18 45V81M49 45V82M29 89V65H40V89M5 36L35 0 63 36M-10 93H80"/><path class="sketch-echo" d="M3 37L35 3 66 38M13 51H58"/><path d="M33 12V26M27 20H39"/></g>
      <g transform="translate(619 46) rotate(8 30 30)"><path d="M8 4Q28 -1 26 20L20 39Q10 46 3 34ZM1 45Q14 39 21 46L16 58H1ZM43 32Q66 32 60 52L51 69Q39 72 35 62ZM33 76Q46 69 53 78L47 87H31Z"/></g>
      <g transform="translate(791 26) rotate(4 35 35)"><path d="M24 82V24M4 43L24 24 44 44M4 48H43V70H5ZM12 48V70M34 48V70M13 58H34M14 82H37M51 25L57 12 64 24M52 5L60 0 67 5M46 40Q75 18 82 46Q78 65 59 62ZM60 62L55 88M65 60L71 86M50 45L75 42"/></g>
      <circle cx="67" cy="121" r="5"/><circle cx="478" cy="121" r="5"/><path d="M825 104L832 116 838 102M830 95V111"/>
      </g><g class="route-transport"><text x="251" y="174" text-anchor="middle">${t('transport')}</text><text x="650" y="174" text-anchor="middle">${t('onFoot')}</text></g>
    </svg><p class="route-caption">${t('routeNote')}</p>
  </div>`;
}
