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

  // Bulk selection elements
  const selectAllPending = document.getElementById('select-all-pending');
  const selectAllApproved = document.getElementById('select-all-approved');
  const pendingBulkActions = document.getElementById('pending-bulk-actions');
  const approvedBulkActions = document.getElementById('approved-bulk-actions');
  const pendingSelectedCount = document.getElementById('pending-selected-count');
  const approvedSelectedCount = document.getElementById('approved-selected-count');
  const bulkApproveBtn = document.getElementById('bulk-approve-btn');
  const bulkDeletePendingBtn = document.getElementById('bulk-delete-pending-btn');
  const bulkDeleteApprovedBtn = document.getElementById('bulk-delete-approved-btn');
  const clearPendingSelectionBtn = document.getElementById('clear-pending-selection-btn');
  const clearApprovedSelectionBtn = document.getElementById('clear-approved-selection-btn');

  let adminSessionKey = '';
  let selectedPending = new Set();
  let selectedApproved = new Set();

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

  // Main render function
  async function render() {
    try {
      // Clear existing selections
      selectedPending.clear();
      selectedApproved.clear();
      
      // Fetch data from both sources
      const pending = await apiListPending();
      const approved = await apiListApproved();
      
      // Render grids
      renderGrid(pendingGrid, pending, true);
      renderGrid(approvedGrid, approved, false);
      
      // Update bulk action visibility
      updateBulkActionVisibility();
      updateSelectAllCheckbox(true);
      updateSelectAllCheckbox(false);
      
      console.log('Admin panel rendered:', { pending: pending.length, approved: approved.length });
    } catch (error) {
      console.error('Error rendering admin panel:', error);
    }
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

  // Bulk selection event listeners
  selectAllPending?.addEventListener('change', (e) => {
    const checkboxes = pendingGrid.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) {
        selectedPending.add(cb.dataset.id);
      } else {
        selectedPending.delete(cb.dataset.id);
      }
    });
    updateBulkActionVisibility();
  });

  selectAllApproved?.addEventListener('change', (e) => {
    const checkboxes = approvedGrid.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) {
        selectedApproved.add(cb.dataset.id);
      } else {
        selectedApproved.delete(cb.dataset.id);
      }
    });
    updateBulkActionVisibility();
  });

  bulkApproveBtn?.addEventListener('click', () => {
    if (selectedPending.size > 0) {
      bulkApprove(Array.from(selectedPending));
    }
  });

  bulkDeletePendingBtn?.addEventListener('click', () => {
    if (selectedPending.size > 0) {
      bulkDelete(Array.from(selectedPending));
    }
  });

  bulkDeleteApprovedBtn?.addEventListener('click', () => {
    if (selectedApproved.size > 0) {
      bulkDelete(Array.from(selectedApproved));
    }
  });

  clearPendingSelectionBtn?.addEventListener('click', () => {
    selectedPending.clear();
    const checkboxes = pendingGrid.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    selectAllPending.checked = false;
    updateBulkActionVisibility();
  });

  clearApprovedSelectionBtn?.addEventListener('click', () => {
    selectedApproved.clear();
    const checkboxes = approvedGrid.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    selectAllApproved.checked = false;
    updateBulkActionVisibility();
  });

  async function render() {
    const [pending, approved] = await Promise.all([
      apiListPending(),
      apiListApproved(),
    ]);
    
    // Clear selections when re-rendering
    selectedPending.clear();
    selectedApproved.clear();
    
    renderGrid(pendingGrid, pending, true);
    renderGrid(approvedGrid, approved, false);
    
    updateBulkActionVisibility();
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
      card.style.position = 'relative';
      
      // Add checkbox for bulk selection
      const checkboxContainer = document.createElement('div');
      checkboxContainer.style.cssText = 'position: absolute; top: 8px; left: 8px; z-index: 10; background: rgba(0,0,0,0.7); border-radius: 4px; padding: 4px;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'item-checkbox';
      checkbox.dataset.id = item.id;
      checkbox.style.cssText = 'margin: 0; cursor: pointer; transform: scale(1.2);';
      checkbox.addEventListener('change', (e) => {
        const selectedSet = isPending ? selectedPending : selectedApproved;
        if (e.target.checked) {
          selectedSet.add(item.id);
        } else {
          selectedSet.delete(item.id);
        }
        updateBulkActionVisibility();
        updateSelectAllCheckbox(isPending);
      });
      checkboxContainer.appendChild(checkbox);
      card.appendChild(checkboxContainer);
      
      const container = document.createElement('div');
      container.className = 'image-container';
      const img = document.createElement('img');
      
      // Enhanced image source handling with new metadata
      let imgSrc;
      if (item.storage_path && window.MonadgramConfig?.buildPublicUrl) {
        // Supabase storage path
        imgSrc = window.MonadgramConfig.buildPublicUrl(item.storage_path);
      } else if (item.src) {
        // Local storage data URL
        imgSrc = item.src;
      } else {
        // Fallback placeholder
        imgSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
      }
      
      img.src = imgSrc;
      img.alt = `Submission by ${item.twitter || 'Unknown'}`;
      img.loading = 'lazy';
      
      // Enhanced metadata display
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      const title = document.createElement('span');
      title.className = 'image-title';
      
      // Show enhanced information including file type
      let titleText = `By ${item.twitter || 'Unknown'}`;
      if (item.fileType) {
        titleText += ` (${item.fileType.split('/')[1].toUpperCase()})`;
      }
      if (item.isGif) {
        titleText += ' 🎬'; // GIF indicator
      }
      title.textContent = titleText;
      
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

  // Bulk action functions
  async function bulkApprove(ids) {
    if (!confirm(`Are you sure you want to approve ${ids.length} submissions?`)) {
      return;
    }
    
    const results = await Promise.all(ids.map(id => apiApprove(id)));
    const successful = results.filter(Boolean).length;
    const failed = results.length - successful;
    
    if (failed > 0) {
      alert(`${successful} approved successfully, ${failed} failed. Check console for details.`);
    } else {
      alert(`Successfully approved ${successful} submissions!`);
    }
    
    selectedPending.clear();
    render();
  }

  async function bulkDelete(ids) {
    if (!confirm(`Are you sure you want to delete ${ids.length} submissions? This action cannot be undone.`)) {
      return;
    }
    
    const results = await Promise.all(ids.map(id => apiDelete(id)));
    const successful = results.filter(Boolean).length;
    const failed = results.length - successful;
    
    if (failed > 0) {
      alert(`${successful} deleted successfully, ${failed} failed. Check console for details.`);
    } else {
      alert(`Successfully deleted ${successful} submissions!`);
    }
    
    selectedPending.clear();
    selectedApproved.clear();
    render();
  }

  // Update bulk action visibility and counts
  function updateBulkActionVisibility() {
    const pendingCount = selectedPending.size;
    const approvedCount = selectedApproved.size;
    
    // Update pending section
    if (pendingCount > 0) {
      pendingBulkActions.style.display = 'flex';
      pendingSelectedCount.textContent = `${pendingCount} selected`;
    } else {
      pendingBulkActions.style.display = 'none';
    }
    
    // Update approved section
    if (approvedCount > 0) {
      approvedBulkActions.style.display = 'flex';
      approvedSelectedCount.textContent = `${approvedCount} selected`;
    } else {
      approvedBulkActions.style.display = 'none';
    }
  }

  // Update select all checkbox state
  function updateSelectAllCheckbox(isPending) {
    const grid = isPending ? pendingGrid : approvedGrid;
    const selectAll = isPending ? selectAllPending : selectAllApproved;
    const checkboxes = grid.querySelectorAll('.item-checkbox');
    const checkedBoxes = grid.querySelectorAll('.item-checkbox:checked');
    
    if (checkboxes.length === 0) {
      selectAll.indeterminate = false;
      selectAll.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
      selectAll.indeterminate = false;
      selectAll.checked = true;
    } else if (checkedBoxes.length > 0) {
      selectAll.indeterminate = true;
      selectAll.checked = false;
    } else {
      selectAll.indeterminate = false;
      selectAll.checked = false;
    }
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

  // Utility function to clear localStorage for testing
  function clearLocalStorage() {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(APPROVED_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    console.log('LocalStorage cleared for testing');
    alert('LocalStorage cleared! Please refresh the page.');
  }

  // Add clear button for testing (you can remove this in production)
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Storage (Testing)';
  clearBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
  clearBtn.addEventListener('click', clearLocalStorage);
  document.body.appendChild(clearBtn);
});



