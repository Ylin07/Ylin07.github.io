(() => {
  const STORAGE_KEY = 'preferred-theme';
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const buttons = [...document.querySelectorAll('[data-theme-toggle]')];

  function savedTheme() {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : '';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme || (media.matches ? 'dark' : 'light');
    const isDark = root.dataset.theme === 'dark';
    buttons.forEach((button) => {
      button.dataset.activeTheme = isDark ? 'dark' : 'light';
      button.setAttribute('aria-label', isDark ? '切换至明亮模式' : '切换至黑夜模式');
    });
  }

  function toggleTheme() {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  applyTheme(savedTheme());

  media.addEventListener('change', () => applyTheme(savedTheme()));
  buttons.forEach((button) => button.addEventListener('click', toggleTheme));
})();

(() => {
  const targets = [...document.querySelectorAll('.toc__target[data-slug]')];
  const items = targets.map((target) => ({
    target,
    heading: document.getElementById(target.dataset.slug)
  })).filter(({ heading }) => heading);
  if (!items.length) return;

  const byHeading = new Map(items.map(({ heading, target }) => [heading, target]));

  function setActive(activeTarget) {
    targets.forEach((target) => target.classList.toggle('is-active', target === activeTarget));
  }

  function openParents(target) {
    let details = target?.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement?.closest('details');
    }
  }

  function getHashTarget(hash) {
    const rawId = hash.replace(/^#/, '');
    try {
      return document.getElementById(decodeURIComponent(rawId)) || document.getElementById(rawId);
    } catch {
      return document.getElementById(rawId);
    }
  }

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(({ isIntersecting }) => isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) setActive(byHeading.get(visible.target));
  }, {
    rootMargin: '-24% 0px -64% 0px',
    threshold: [0, 1]
  });

  items.forEach(({ heading }) => observer.observe(heading));
  targets.forEach((target) => target.addEventListener('click', () => setActive(target)));

  const initialTarget = byHeading.get(getHashTarget(location.hash));
  if (initialTarget) {
    setActive(initialTarget);
    openParents(initialTarget);
  }
})();

(() => {
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-code]');
    if (!button) return;

    const code = button.closest('pre')?.querySelector('code');
    if (!code) return;

    try {
      const copied = await copyText(code.textContent || '');
      button.textContent = copied ? 'Copied' : 'Failed';
    } catch {
      button.textContent = 'Failed';
    }

    clearTimeout(button._copyTimer);
    button._copyTimer = setTimeout(() => {
      button.textContent = 'Copy';
    }, 1600);
  });
})();

(() => {
  const locks = [...document.querySelectorAll('[data-article-lock]')];
  if (!locks.length || !window.crypto?.subtle) return;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function fromBase64(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }

  function concatBytes(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  }

  async function decrypt(payload, password) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: fromBase64(payload.salt),
        iterations: payload.iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const encrypted = concatBytes(fromBase64(payload.data), fromBase64(payload.tag));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, encrypted);
    return decoder.decode(decrypted);
  }

  function bindLock(lock) {
    const form = lock.querySelector('[data-lock-form]');
    const message = lock.querySelector('[data-lock-message]');
    const payloadEl = lock.querySelector('[data-lock-payload]');
    const content = lock.querySelector('[data-lock-content]');
    const panel = lock.querySelector('.article-lock__panel');
    const payload = JSON.parse(payloadEl.textContent || '{}');

    async function unlock(password) {
      try {
        const html = await decrypt(payload, password);
        content.innerHTML = html;
        content.hidden = false;
        panel.hidden = true;
      } catch {
        message.textContent = '密码不正确。';
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      message.textContent = '';
      unlock(new FormData(form).get('password') || '');
    });
  }

  locks.forEach(bindLock);
})();

(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  const body = document.body;
  let navigating = false;

  const clearPreload = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove('is-page-transition-preload');
    }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', clearPreload, { once: true });
  } else {
    clearPreload();
  }

  function shouldAnimate(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return false;

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/.test(href)) return false;

    const url = new URL(link.href, location.href);
    const samePage = url.pathname === location.pathname && url.search === location.search;
    return url.origin === location.origin && !(samePage && url.hash);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!shouldAnimate(link, event) || navigating) return;

    event.preventDefault();
    navigating = true;
    root.classList.add('is-page-transition-lock');
    body.classList.add('is-page-leaving');
    setTimeout(() => { location.href = link.href; }, 220);
  });

  window.addEventListener('pageshow', () => {
    navigating = false;
    root.classList.remove('is-page-transition-lock', 'is-page-transition-preload');
    body.classList.remove('is-page-leaving');
  });

  window.addEventListener('pagehide', () => body.classList.add('is-page-leaving'));
})();

(() => {
  const form = document.querySelector('[data-search-form]');
  if (!form) return;

  const input = form.querySelector('[data-search-input]');
  const status = form.querySelector('[data-search-status]');
  const results = form.querySelector('[data-search-results]');
  const siteRoot = new URL(form.dataset.searchIndex, location.href);
  let posts = [];

  function render() {
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (!query) {
      form.classList.remove('is-open');
      return;
    }

    const matches = posts.filter((post) =>
      [post.title, ...post.tags, ...post.categories].join(' ').toLowerCase().includes(query)
    );
    status.textContent = `找到 ${matches.length} 篇文章`;
    matches.forEach((post) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = new URL(post.url.split('/').slice(1).join('/'), siteRoot).href;
      link.textContent = post.title;
      item.append(link);
      results.append(item);
    });
    form.classList.add('is-open');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    results.querySelector('a')?.click();
  });
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) form.classList.remove('is-open');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') form.classList.remove('is-open');
  });
  fetch(form.dataset.searchIndex)
    .then((response) => response.json())
    .then((data) => { posts = data; render(); })
    .catch(() => { status.textContent = '搜索索引加载失败'; form.classList.add('is-open'); });
})();

(() => {
  const bar = document.querySelector('[data-reading-progress]');
  const article = document.querySelector('.markdown-content');
  if (!bar || !article) {
    bar?.remove();
    return;
  }

  function update() {
    const start = article.getBoundingClientRect().top + scrollY;
    const distance = Math.max(1, article.offsetHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, (scrollY - start) / distance));
    bar.style.transform = `scaleX(${progress})`;
  }

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
