(function (root) {
  const defaultAssetBase = (() => {
    if (typeof document === 'undefined') return './';
    const script = Array.from(document.scripts).find((item) => /sponsor-stars(?:\.min)?\.js(?:$|\?)/.test(item.src));
    return script ? new URL('.', script.src).href : './';
  })();

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  let bagSequence = 0;

  function bagArtwork(id) {
    return `<svg class="ss-bag-art" viewBox="0 0 260 250" xmlns="http://www.w3.org/2000/svg" focusable="false" data-star-count="0">
      <defs>
        <linearGradient id="${id}-fabric" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8df"/><stop offset=".55" stop-color="#f0dfb8"/><stop offset="1" stop-color="#d5b786"/></linearGradient>
        <linearGradient id="${id}-fold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff9e5"/><stop offset="1" stop-color="#e6c99a"/></linearGradient>
      </defs>
      <ellipse cx="131" cy="237" rx="86" ry="8" fill="#6e7452" opacity=".12"/>
      <path d="M77 127 C67 145 48 177 49 202 Q49 215 63 223 Q49 227 53 233 Q83 242 111 236 Q153 244 185 234 Q203 239 210 231 Q212 225 197 219 C209 198 201 161 185 129 Z" fill="url(#${id}-fabric)" stroke="#a58b61" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M79 145 C66 166 60 190 64 208 M182 145 C192 165 197 190 188 209 M74 224 Q95 232 113 228 M171 226 Q185 230 195 226" fill="none" stroke="#b29a73" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
      <path d="M72 164 C67 185 69 208 88 217 Q113 230 142 226 Q97 218 91 194 Q84 177 88 154" fill="#fff9e8" opacity=".43"/>
      <ellipse cx="130" cy="117" rx="65" ry="18" fill="#d5b481" stroke="#aa8a5f" stroke-width="2"/>
      <g class="ss-bag-stars" stroke-linejoin="round"></g>
      <path d="M68 116 Q78 126 97 124 Q117 130 136 125 Q157 130 178 123 Q191 125 196 116 L192 130 Q203 139 193 146 Q178 153 160 146 Q134 154 110 147 Q86 152 70 144 Q60 138 69 129 Z" fill="url(#${id}-fold)" stroke="#a58b61" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M76 134 Q92 141 109 137 Q133 145 156 138 Q176 145 187 136 M83 148 L79 156 M177 147 L181 157" fill="none" stroke="#c1a77d" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M112 176 Q130 170 148 176 M110 181 Q129 176 151 181" fill="none" stroke="#bfa578" stroke-width="1" opacity=".38"/>
    </svg>`;
  }

  const starSlots = [9, 11, 13, 15, 15, 13, 11, 13].flatMap((count, row) =>
    Array.from({length: count}, (_, column) => {
      const offset = column === 0 ? 0 : Math.ceil(column / 2) * (column % 2 ? -1 : 1);
      return {x: 130 + offset * 11.5 + (row % 2 ? 3 : 0), y: 111 - row * 11, row, column};
    })
  );

  function starMarkup(count) {
    return starSlots.slice(0, count).map(({x, y, row, column}, index) => {
      const radius = index < 9 ? 10.5 : 8.3;
      const points = Array.from({length: 10}, (_, point) => {
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const distance = radius * (point % 2 ? .46 : 1);
        return `${(Math.cos(angle) * distance).toFixed(2)},${(Math.sin(angle) * distance).toFixed(2)}`;
      }).join(' ');
      const color = ['#e9c66b', '#f3d784', '#d9b15c', '#f4dea0'][index % 4];
      return `<polygon class="ss-bag-star" data-star="${index + 1}" points="${points}" transform="translate(${x} ${y}) rotate(${((column * 17 + row * 11) % 39) - 19})" fill="${color}" stroke="#ab8853" stroke-width="1.25"/>`;
    }).join('');
  }

  class SponsorStars {
    constructor(options) {
      const config = options || {};
      this.projects = config.projects || [];
      this.mapLayer = typeof config.mapLayer === 'string' ? document.querySelector(config.mapLayer) : config.mapLayer;
      this.mount = config.mount || document.body;
      this.getProjectPoint = config.getProjectPoint || this.defaultProjectPoint.bind(this);
      this.onFund = config.onFund || function () {};
      this.onSelect = config.onSelect || function () {};
      this.currency = config.currency || '¥';
      this.bagImage = config.bagImage || `${defaultAssetBase}assets/star-bag.png`;
      this.unitLabel = config.unitLabel || '万';
      this.projectBudget = config.projectBudget || 1;
      this.funded = new Set(config.fundedProjectIds || []);
      this.isAnimating = false;
      this.disposed = false;
      this.flightAnimations = new Set();
      this.effects = new Set();
      this.bagId = `ss-bag-${++bagSequence}`;
      this.init();
    }

    init() {
      this.buildWidget();
      this.buildMarkers();
      this.refreshMarkers();
      this.resizeHandler = () => this.refreshMarkers();
      window.addEventListener('resize', this.resizeHandler);
      this.refreshLoop();
    }

    buildWidget() {
      this.widget = document.createElement('section');
      this.widget.className = 'ss-widget is-open';
      this.widget.innerHTML = `
        <button class="ss-bag-button" type="button" aria-expanded="true">
          <span class="ss-bag-icon" aria-hidden="true">${bagArtwork(this.bagId)}</span>
          <span class="ss-bag-copy"><strong>星星布袋</strong><small>装下一次远方</small><small class="ss-bag-preview">已装入 <span class="ss-bag-star-number">1</span> 颗星星</small></span>
          <span class="ss-bag-count"><b>${this.funded.size}</b><small>已点亮</small></span>
        </button>
        <div class="ss-panel is-open" aria-hidden="false">
          <div class="ss-panel-kicker"><span>投入星星</span><span>1 万 = 1 颗星星</span></div>
          <div class="ss-amount-row"><span class="ss-amount-label">支持的远方</span><b class="ss-amount-value">¥ <span class="ss-amount-number">1</span> 万</b></div>
          <input class="ss-range" type="range" min="1" max="100" step="1" value="1" aria-label="投入金额，单位万元" />
          <div class="ss-range-scale"><span>1 万</span><span>100 万</span></div>
          <div class="ss-estimate"><i>✦</i><span>点亮 <b class="ss-project-number">1</b> 个真实旅程目的地</span></div>
          <button class="ss-confirm" type="button">让星星出发 ↗</button>
          <div class="ss-status" aria-live="polite"></div>
          <div class="ss-impact" hidden></div>
        </div>`;
      this.mount.appendChild(this.widget);
      this.bagButton = this.widget.querySelector('.ss-bag-button');
      this.panel = this.widget.querySelector('.ss-panel');
      this.range = this.widget.querySelector('.ss-range');
      this.amountNumber = this.widget.querySelector('.ss-amount-number');
      this.projectNumber = this.widget.querySelector('.ss-project-number');
      this.starNumber = this.widget.querySelector('.ss-bag-star-number');
      this.starLayer = this.widget.querySelector('.ss-bag-stars');
      this.bagArtwork = this.widget.querySelector('.ss-bag-art');
      this.status = this.widget.querySelector('.ss-status');
      this.impact = this.widget.querySelector('.ss-impact');
      this.bagCount = this.widget.querySelector('.ss-bag-count');
      this.confirmButton = this.widget.querySelector('.ss-confirm');
      this.bagButton.addEventListener('click', () => this.togglePanel());
      this.range.addEventListener('input', () => this.updateEstimate());
      this.confirmButton.addEventListener('click', () => this.fund());
      this.updateEstimate();
    }

    buildMarkers() {
      if (!this.mapLayer) return;
      this.mapLayer.style.position = this.mapLayer.style.position || 'absolute';
      this.mapLayer.style.inset = this.mapLayer.style.inset || '0';
      this.mapLayer.style.pointerEvents = 'none';
      this.markers = new Map();
      this.projects.forEach((project) => {
        const marker = document.createElement('button');
        marker.type = 'button'; marker.className = 'ss-map-marker';
        marker.dataset.projectId = project.id;
        marker.setAttribute('aria-label', `查看${project.city}的旅程`);
        marker.addEventListener('click', () => this.onSelect(project));
        if (this.funded.has(project.id)) marker.classList.add('is-funded');
        this.mapLayer.appendChild(marker);
        this.markers.set(project.id, marker);
      });
    }

    defaultProjectPoint(project) {
      const width = this.mapLayer ? this.mapLayer.clientWidth : 1;
      const height = this.mapLayer ? this.mapLayer.clientHeight : 1;
      return { x: ((project.lng + 180) / 360) * width, y: ((90 - project.lat) / 180) * height, visible: true };
    }

    refreshMarkers() {
      if (!this.mapLayer || !this.markers) return;
      this.projects.forEach((project) => {
        const marker = this.markers.get(project.id);
        const point = this.getProjectPoint(project, this.mapLayer) || {};
        if (typeof point.x !== 'number' || typeof point.y !== 'number') return;
        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;
        marker.classList.toggle('is-visible', point.visible !== false);
        marker.classList.toggle('is-funded', this.funded.has(project.id));
      });
    }

    refreshLoop() {
      this.refreshMarkers();
      this.refreshFrame = requestAnimationFrame(() => this.refreshLoop());
    }

    togglePanel(force) {
      const open = typeof force === 'boolean' ? force : !this.panel.classList.contains('is-open');
      this.panel.classList.toggle('is-open', open);
      this.panel.setAttribute('aria-hidden', String(!open));
      this.bagButton.setAttribute('aria-expanded', String(open));
      this.widget.classList.toggle('is-open', open);
    }

    updateEstimate() {
      const amount = Math.max(1, Math.min(100, Math.round(Number(this.range.value) || 1)));
      const projects = this.getTargetProjects(amount);
      this.amountNumber.textContent = amount;
      this.projectNumber.textContent = projects.length;
      this.starNumber.textContent = amount;
      this.range.setAttribute('aria-valuetext', `${amount} 万元，${amount} 颗星星`);
      this.range.style.setProperty('--ss-progress', `${(amount - 1) / 99 * 100}%`);
      this.widget.dataset.starCount = String(amount);
      this.bagArtwork.dataset.starCount = String(amount);
      if (this.starLayer.dataset.count !== String(amount)) {
        this.starLayer.innerHTML = starMarkup(amount);
        this.starLayer.dataset.count = String(amount);
      }
    }

    getTargetProjects(amount) {
      const count = Math.min(Math.floor(amount / this.projectBudget), this.projects.length - this.funded.size);
      return this.projects.filter((project) => !this.funded.has(project.id)).slice(0, Math.max(0, count));
    }

    async fund() {
      if (this.isAnimating) return;
      const amount = Number(this.range.value);
      const targetProjects = this.getTargetProjects(amount);
      const count = targetProjects.length;
      if (!targetProjects.length) {
        this.status.textContent = '所有旅程目的地都已点亮。';
        return;
      }
      this.isAnimating = true;
      this.confirmButton.disabled = true;
      this.status.textContent = `正在把 ${count} 颗星星送往地图……`;
      const start = this.bagButton.querySelector('.ss-bag-icon').getBoundingClientRect();
      await Promise.all(targetProjects.map((project, index) => this.animateStar(project, start, index)));
      if (this.disposed) return;
      targetProjects.forEach((project) => this.funded.add(project.id));
      const bagCountNumber = this.bagCount.querySelector('b');
      if (bagCountNumber) bagCountNumber.textContent = this.funded.size;
      this.renderImpact(targetProjects, amount);
      this.status.textContent = `完成：${count} 个项目已经被点亮。`;
      this.confirmButton.disabled = false;
      this.isAnimating = false;
      this.updateEstimate();
      this.onFund({ amount, projects: targetProjects, fundedProjectIds: Array.from(this.funded) });
    }

    animateStar(project, start, index) {
      if (this.disposed || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
      return new Promise((resolve) => {
        const marker = this.markers && this.markers.get(project.id);
        let target = marker ? marker.getBoundingClientRect() : null;
        if (!target || target.width === 0) target = { left: window.innerWidth * .52, top: window.innerHeight * .48, width: 0, height: 0 };
        const star = document.createElement('span');
        star.className = 'ss-flight-star'; star.textContent = '✦';
        star.style.left = `${start.left + start.width / 2 - 11}px`; star.style.top = `${start.top + start.height / 2 - 11}px`;
        document.body.appendChild(star);
        this.effects.add(star);
        const dx = target.left + target.width / 2 - (start.left + start.width / 2);
        const dy = target.top + target.height / 2 - (start.top + start.height / 2);
        const animation = star.animate([{ transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 }, { transform: `translate(${dx * .48}px, ${dy * .25}px) rotate(${index % 2 ? 190 : -190}deg) scale(1.24)`, opacity: 1, offset: .48 }, { transform: `translate(${dx}px, ${dy}px) rotate(${index % 2 ? 340 : -340}deg) scale(.3)`, opacity: .2 }], { duration: 1450 + (index % 7) * 130, delay: (index % 20) * 80, easing: 'cubic-bezier(.18,.8,.25,1)', fill: 'forwards' });
        this.flightAnimations.add(animation);
        animation.finished.then(() => { if (!this.disposed) this.flash(target.left + target.width / 2, target.top + target.height / 2); }).catch(() => {}).finally(() => {
          star.remove(); this.effects.delete(star); this.flightAnimations.delete(animation); resolve();
        });
      });
    }

    flash(x, y) { const ring = document.createElement('span'); ring.className = 'ss-flash'; ring.style.left = `${x}px`; ring.style.top = `${y}px`; document.body.appendChild(ring); this.effects.add(ring); setTimeout(() => { ring.remove(); this.effects.delete(ring); }, 800); }

    renderImpact(projects, amount) {
      const destinations = new Set(projects.map((project) => project.city)).size;
      const sample = projects.slice(0, 3).map((project) => `<div class="ss-impact-item"><span>${escapeHTML(project.city)} · ${escapeHTML(project.focus)}</span><span>↗</span></div>`).join('');
      this.impact.hidden = false;
      this.impact.innerHTML = `<div class="ss-impact-title">这笔 ${this.currency}${amount} 万，已经留下</div><div class="ss-impact-stats"><div class="ss-impact-stat"><b>${projects.length}</b><small>项目</small></div><div class="ss-impact-stat"><b>${destinations}</b><small>目的地</small></div><div class="ss-impact-stat"><b>${amount}</b><small>万元</small></div></div><div class="ss-impact-list">${sample}</div>`;
    }

    destroy() { this.disposed = true; cancelAnimationFrame(this.refreshFrame); window.removeEventListener('resize', this.resizeHandler); for (const animation of this.flightAnimations) animation.cancel(); this.flightAnimations.clear(); for (const effect of this.effects) effect.remove(); this.effects.clear(); this.widget.remove(); if (this.mapLayer && this.markers) this.markers.forEach((marker) => marker.remove()); }
  }
  root.SponsorStars = SponsorStars;
}(typeof window !== 'undefined' ? window : globalThis));
