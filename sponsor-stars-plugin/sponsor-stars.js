(function (root) {
  const defaultAssetBase = (() => {
    if (typeof document === 'undefined') return './';
    const script = Array.from(document.scripts).find((item) => /sponsor-stars(?:\.min)?\.js(?:$|\?)/.test(item.src));
    return script ? new URL('.', script.src).href : './';
  })();

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

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
      this.widget.className = 'ss-widget';
      this.widget.innerHTML = `
        <button class="ss-bag-button" type="button" aria-expanded="true">
          <span class="ss-bag-icon" aria-hidden="true"><img class="ss-bag-image" src="${escapeHTML(this.bagImage)}" alt="" /></span>
          <span class="ss-bag-copy"><strong>星星布袋</strong><small>装下一次远方</small></span>
          <span class="ss-bag-count"><b>${this.funded.size}</b><small>已点亮</small></span>
        </button>
        <div class="ss-panel is-open" aria-hidden="false">
          <div class="ss-panel-kicker"><span>投入星星</span><span>1 万 = 1 项目</span></div>
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
    }

    updateEstimate() {
      const amount = Number(this.range.value);
      const projects = this.getTargetProjects(amount);
      this.amountNumber.textContent = amount;
      this.projectNumber.textContent = projects.length;
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
      targetProjects.forEach((project) => this.funded.add(project.id));
      const bagCountNumber = this.bagCount.querySelector('b');
      if (bagCountNumber) bagCountNumber.textContent = this.funded.size;
      this.renderImpact(targetProjects, amount);
      this.status.textContent = `完成：${count} 个项目已经被点亮。`;
      this.confirmButton.disabled = false;
      this.isAnimating = false;
      this.onFund({ amount, projects: targetProjects, fundedProjectIds: Array.from(this.funded) });
    }

    animateStar(project, start, index) {
      return new Promise((resolve) => {
        const marker = this.markers && this.markers.get(project.id);
        let target = marker ? marker.getBoundingClientRect() : null;
        if (!target || target.width === 0) target = { left: window.innerWidth * .52, top: window.innerHeight * .48, width: 0, height: 0 };
        const star = document.createElement('span');
        star.className = 'ss-flight-star'; star.textContent = '✦';
        star.style.left = `${start.left + start.width / 2 - 11}px`; star.style.top = `${start.top + start.height / 2 - 11}px`;
        document.body.appendChild(star);
        const dx = target.left + target.width / 2 - (start.left + start.width / 2);
        const dy = target.top + target.height / 2 - (start.top + start.height / 2);
        const animation = star.animate([{ transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 }, { transform: `translate(${dx * .48}px, ${dy * .25}px) rotate(${index % 2 ? 190 : -190}deg) scale(1.24)`, opacity: 1, offset: .48 }, { transform: `translate(${dx}px, ${dy}px) rotate(${index % 2 ? 340 : -340}deg) scale(.3)`, opacity: .2 }], { duration: 1450 + (index % 7) * 130, delay: (index % 20) * 80, easing: 'cubic-bezier(.18,.8,.25,1)', fill: 'forwards' });
        animation.finished.then(() => { star.remove(); this.flash(target.left + target.width / 2, target.top + target.height / 2); resolve(); }).catch(resolve);
      });
    }

    flash(x, y) { const ring = document.createElement('span'); ring.className = 'ss-flash'; ring.style.left = `${x}px`; ring.style.top = `${y}px`; document.body.appendChild(ring); setTimeout(() => ring.remove(), 800); }

    renderImpact(projects, amount) {
      const destinations = new Set(projects.map((project) => project.city)).size;
      const sample = projects.slice(0, 3).map((project) => `<div class="ss-impact-item"><span>${escapeHTML(project.city)} · ${escapeHTML(project.focus)}</span><span>↗</span></div>`).join('');
      this.impact.hidden = false;
      this.impact.innerHTML = `<div class="ss-impact-title">这笔 ${this.currency}${amount} 万，已经留下</div><div class="ss-impact-stats"><div class="ss-impact-stat"><b>${projects.length}</b><small>项目</small></div><div class="ss-impact-stat"><b>${destinations}</b><small>目的地</small></div><div class="ss-impact-stat"><b>${amount}</b><small>万元</small></div></div><div class="ss-impact-list">${sample}</div>`;
    }

    destroy() { cancelAnimationFrame(this.refreshFrame); window.removeEventListener('resize', this.resizeHandler); this.widget.remove(); if (this.mapLayer && this.markers) this.markers.forEach((marker) => marker.remove()); }
  }
  root.SponsorStars = SponsorStars;
}(typeof window !== 'undefined' ? window : globalThis));
