document.addEventListener('DOMContentLoaded', () => {
  const PASSWORD = 'Rockstar01';
  const PENDING_KEY = 'monadgram_pending';
  const APPROVED_KEY = 'monadgram_approved';
  const ADMIN_SESSION_KEY = 'monadgram_admin_session';

  const authSection = document.getElementById('admin-auth');
  const panelSection = document.getElementById('admin-panel');
  const loginBtn = document.getElementById('admin-login');
  const logoutBtn = document.getElementById('admin-logout');
  const passwordInput = document.getElementById('admin-password');
  const errorEl = document.getElementById('admin-error');
  const pendingGrid = document.getElementById('pending-grid');
  const approvedGrid = document.getElementById('approved-grid');

  let adminSessionKey = '';

  // Check if already logged in on page load
  function checkExistingSession() {
    const savedSession = localStorage.getItem(ADMIN_SESSION_KEY);
    
    // Check if session exists
    if (savedSession === PASSWORD) {
      adminSessionKey = savedSession;
      authSection.style.display = 'none';
      panelSection.style.display = 'block';
      render();
      return true;
    }
    return false;
  }

  // Login function
  function login(password) {
    if (password === PASSWORD) {
      adminSessionKey = password;
      localStorage.setItem(ADMIN_SESSION_KEY, password);
      authSection.style.display = 'none';
      panelSection.style.display = 'block';
      render();
      return true;
    } else {
      errorEl.style.display = 'block';
      return false;
    }
  }

  // Logout function
  function logout() {
    adminSessionKey = '';
    localStorage.removeItem(ADMIN_SESSION_KEY);
    authSection.style.display = 'block';
    panelSection.style.display = 'none';
    passwordInput.value = '';
    errorEl.style.display = 'none';
  }

  // Check for existing session on page load
  if (!checkExistingSession()) {
    // Show auth section if not logged in
    authSection.style.display = 'block';
    panelSection.style.display = 'none';
  }

  loginBtn.addEventListener('click', () => {
    const val = passwordInput.value || '';
    login(val);
  });

  // Logout button
  logoutBtn.addEventListener('click', () => {
    logout();
  });

  // Allow Enter key to login
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const val = passwordInput.value || '';
      login(val);
    }
  });

  async function render() {
    const [pending, approved] = await Promise.all([
      apiListPending(),
      apiListApproved(),
    ]);
    renderGrid(pendingGrid, pending, true);
    renderGrid(approvedGrid, approved, false);
  }

  function renderGrid(root, items, isPending) {
    root.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = isPending ? 'No pending submissions.' : 'No approved submissions yet.';
      empty.style.color = 'rgba(230,241,255,0.8)';
      root.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'image-card';
      const container = document.createElement('div');
      container.className = 'image-container';
      const img = document.createElement('img');
      // Prefer storage_path from Supabase; fallback to local 'src' if present
      const cfg = window.MonadgramConfig || {};
      const publicUrl = item.storage_path && cfg.buildPublicUrl ? cfg.buildPublicUrl(item.storage_path) : item.src;
      img.src = publicUrl;
      img.alt = `Submission by ${item.twitter}`;
      img.loading = 'lazy';
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      const title = document.createElement('span');
      title.className = 'image-title';
      title.textContent = `By ${item.twitter}`;
      overlay.appendChild(title);
      container.appendChild(img);
      container.appendChild(overlay);
      card.appendChild(container);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.margin = '10px 0 0 0';

      if (isPending) {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn btn--primary btn--sm';
        approveBtn.textContent = 'Approve';
        approveBtn.addEventListener('click', () => approve(item.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn--secondary btn--sm';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => remove(item.id, true));

        actions.appendChild(approveBtn);
        actions.appendChild(deleteBtn);
      } else {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn--secondary btn--sm';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => remove(item.id, false));
        actions.appendChild(deleteBtn);
      }

      card.appendChild(actions);
      root.appendChild(card);
    });
  }

  function getPendingSubmissions() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
  }
  function setPendingSubmissions(items) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  }
  function getApprovedSubmissions() {
    try { return JSON.parse(localStorage.getItem(APPROVED_KEY) || '[]'); } catch { return []; }
  }
  function setApprovedSubmissions(items) {
    localStorage.setItem(APPROVED_KEY, JSON.stringify(items));
  }

  async function approve(id) {
    const ok = await apiApprove(id);
    if (!ok) {
      alert('Approve failed. Check function logs.');
      return;
    }
    render();
  }

  async function remove(id) {
    const ok = await apiDelete(id);
    if (!ok) {
      alert('Delete failed.');
      return;
    }
    render();
  }

  // ---- API helpers (Edge Functions) ----
  async function apiListPending() {
    const url = window.MonadgramConfig?.EDGE?.LIST_PENDING_URL || '';
    if (!url) return getPendingSubmissions();
    const cfg = window.MonadgramConfig || {};
    const res = await fetch(url, { headers: {
      'x-admin-key': adminSessionKey,
      ...(cfg.SUPABASE_ANON_KEY ? { 'apikey': cfg.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}),
    } });
    if (!res.ok) return getPendingSubmissions();
    const json = await res.json();
    return json.items || [];
  }
  async function apiApprove(id) {
    const url = window.MonadgramConfig?.EDGE?.APPROVE_URL || '';
    if (!url) return;
    const cfg = window.MonadgramConfig || {};
    const res = await fetch(url, { method: 'POST', headers: {
      'content-type': 'application/json',
      'x-admin-key': adminSessionKey,
      ...(cfg.SUPABASE_ANON_KEY ? { 'apikey': cfg.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}),
    }, body: JSON.stringify({ id }) });
    return res.ok;
  }
  async function apiDelete(id) {
    const url = window.MonadgramConfig?.EDGE?.DELETE_URL || '';
    if (!url) return;
    const cfg = window.MonadgramConfig || {};
    const res = await fetch(url, { method: 'POST', headers: {
      'content-type': 'application/json',
      'x-admin-key': adminSessionKey,
      ...(cfg.SUPABASE_ANON_KEY ? { 'apikey': cfg.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}),
    }, body: JSON.stringify({ id }) });
    return res.ok;
  }
  async function apiListApproved() {
    const cfg = window.MonadgramConfig || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return getApprovedSubmissions();
    const url = `${cfg.SUPABASE_URL}/rest/v1/submissions?select=id,storage_path,twitter,created_at&status=eq.approved&order=created_at.desc`;
    const res = await fetch(url, { headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` } });
    if (!res.ok) return getApprovedSubmissions();
    return res.json();
  }
});


