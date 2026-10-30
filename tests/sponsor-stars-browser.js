const frame = document.querySelector('iframe');
const results = document.querySelector('#results');
const runButton = document.querySelector('#run');
const amountButtons = [...document.querySelectorAll('[data-amount]')];
const rootURL = new URL('../', document.baseURI).href;
let loadId = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (predicate()) return; await pause(50); }
  throw new Error(`等待超时：${label}`);
}

// Run before the real application module, inside only this disposable iframe.
function installReadOnlyDonor() {
  const nativeFetch = window.fetch.bind(window);
  window.__sponsorPreviewBlockedWrites = 0;
  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) {
      window.__sponsorPreviewBlockedWrites++;
      return Response.json({error: 'previewReadOnly'}, {status: 403});
    }
    if (url.pathname === '/api/auth/me') return Response.json({user: {id: 'preview-donor', name: '布袋预览', email: 'donor-preview@example.test', role: 'donor'}, role: 'donor', csrfToken: 'preview-only'});
    if (url.pathname === '/api/projects') return Response.json({projects: []});
    if (url.pathname === '/api/agent/status') return Response.json({publishing: false, analysis: false, provider: 'DeepSeek', role: 'donor'});
    // Do not pass real account/session cookies to any remaining read request.
    return nativeFetch(input, {...init, credentials: 'omit'});
  };
}

function setAmount(amount) {
  const doc = frame.contentDocument, win = frame.contentWindow;
  const range = doc.querySelector('.ss-range');
  if (!range) throw new Error('布袋尚未载入');
  range.value = String(amount);
  range.dispatchEvent(new win.Event('input', {bubbles: true}));
}

async function loadPreview() {
  const currentLoad = ++loadId;
  runButton.disabled = true;
  amountButtons.forEach(button => { button.disabled = true; });
  results.className = '';
  results.textContent = '正在载入真实首页…';
  try {
    const response = await fetch(new URL('index.html', rootURL), {cache: 'no-store', credentials: 'omit'});
    if (!response.ok) throw new Error(`首页返回 ${response.status}`);
    let source = await response.text();
    source = source.replace(/<head>/i, `<head><base href="${rootURL}"><meta http-equiv="Content-Security-Policy" content="form-action 'none'">`);
    const bootstrap = `<script>(${installReadOnlyDonor.toString()})();<\/script>`;
    source = source.replace(/<script\b[^>]*type="module"[^>]*src="src\/js\/app\.js"[^>]*><\/script>/i, match => `${bootstrap}${match}`);
    if (!source.includes(bootstrap)) throw new Error('未找到首页启动脚本，未加载预览');
    frame.srcdoc = source;
    await until(() => frame.contentDocument?.body.dataset.role === 'donor' && frame.contentDocument.querySelector('.ss-range'), 'donor 布袋');
    if (currentLoad !== loadId) return;
    runButton.disabled = false;
    amountButtons.forEach(button => { button.disabled = false; });
    results.textContent = '预览已就绪。可拖动布袋滑块，或选择上方金额观察星星数量。';
  } catch (error) {
    if (currentLoad !== loadId) return;
    results.className = 'fail'; results.textContent = `FAIL ${error.message}`;
  }
}

for (const button of amountButtons) button.onclick = () => setAmount(Number(button.dataset.amount));
for (const button of document.querySelectorAll('[data-size]')) button.onclick = () => {
  const mobile = button.dataset.size === 'mobile';
  frame.style.width = mobile ? '390px' : '1440px';
  frame.style.height = mobile ? '844px' : '900px';
  loadPreview();
};
document.querySelector('#reset').onclick = loadPreview;

runButton.onclick = async () => {
  runButton.disabled = true; results.textContent = ''; results.className = '';
  const check = (value, label) => { if (!value) throw new Error(label); results.textContent += `PASS ${label}\n`; };
  try {
    const doc = frame.contentDocument, win = frame.contentWindow;
    const widget = doc.querySelector('.ss-widget');
    const panel = widget.querySelector('.ss-panel');
    const bagButton = widget.querySelector('.ss-bag-button');
    check(doc.body.dataset.role === 'donor', '隔离 donor 身份已挂载实际首页');
    const expectedOpen = win.matchMedia('(min-width: 901px)').matches;
    check(panel.classList.contains('is-open') === expectedOpen, '初始展开状态符合桌面／手机布局');
    for (const amount of [1, 14, 50, 100, 3]) {
      setAmount(amount);
      await until(() => widget.querySelectorAll('.ss-bag-star').length === amount, `${amount} 颗星`);
      const countHost = widget.matches('[data-star-count]') ? widget : widget.querySelector('[data-star-count]');
      check(widget.querySelectorAll('.ss-bag-star').length === amount && Number(countHost?.dataset.starCount) === amount, `${amount} 万对应 ${amount} 颗星（包括调低金额）`);
      check(Number(widget.querySelector('.ss-amount-number').textContent) === amount, `${amount} 万金额文本同步`);
      check(Number(widget.querySelector('.ss-project-number').textContent) <= 4, '预计点亮数不超出四个真实目的地');
    }
    const wasOpen = panel.classList.contains('is-open');
    bagButton.click();
    check(panel.classList.contains('is-open') !== wasOpen && bagButton.getAttribute('aria-expanded') === String(!wasOpen), '布袋卡片切换展开／收起');
    bagButton.click();
    check(panel.classList.contains('is-open') === wasOpen && widget.classList.contains('is-open') === wasOpen, '收起与展开样式保持同步');
    setAmount(14);
    if (!panel.classList.contains('is-open')) bagButton.click();
    widget.querySelector('.ss-confirm').click();
    await until(() => !widget.querySelector('.ss-confirm').disabled, '星星出发动画');
    check(Number(widget.querySelector('.ss-bag-count b').textContent) === 4, '金额 14 万仍只点亮实际存在的四个目的地');
    check(Number(widget.querySelector('.ss-project-number').textContent) === 0, '点亮后预计数量更新为零');
    check(win.__sponsorPreviewBlockedWrites === 0, '金额与点亮动画没有发送写请求');
    results.textContent += '\n全部检查通过；当前保留 14 万预览。';
  } catch (error) { results.className = 'fail'; results.textContent += `FAIL ${error.message}`; }
  finally { runButton.disabled = false; }
};

loadPreview();
