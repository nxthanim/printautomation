const API_BASE = '/api';

function showAlert(message, type) {
  const alert = document.getElementById('order-alert');
  alert.textContent = message;
  alert.className = `alert ${type}`;
  alert.classList.remove('hidden');
  setTimeout(() => alert.classList.add('hidden'), 5000);
}

async function fetchDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateDashboard(data);
  } catch (e) {
    console.error('Dashboard fetch error:', e);
  }
}

function updateDashboard(data) {
  updatePrinterGrid(data.printers);
  document.getElementById('pending-count').textContent = `Pending: ${data.pending_orders}`;
  document.getElementById('active-count').textContent = `Active: ${data.active_jobs}`;
  document.getElementById('printer-count').textContent = `Printers: ${data.printers.length}`;
  document.getElementById('printer-subtitle').textContent =
    `Online: ${data.printers.filter(p => p.status !== 'offline').length} / ${data.printers.length}`;
}

function updatePrinterGrid(printers) {
  const grid = document.getElementById('printer-grid');
  if (printers.length === 0) {
    grid.innerHTML = '<div class="loading">No printers registered</div>';
    return;
  }

  grid.innerHTML = '';
  printers.forEach(p => {
    const card = document.createElement('div');
    card.className = `printer-card ${p.status}`;

    const lastSeen = p.last_heartbeat
      ? new Date(p.last_heartbeat).toLocaleString()
      : 'Never';

    card.innerHTML = `
      <h3>${escapeHtml(p.name)}</h3>
      ${p.client_name ? `<div class="client-name">${escapeHtml(p.client_name)}</div>` : ''}
      <span class="status status-${p.status}">${p.status}</span>
      <div class="job-count">Active jobs: ${p.active_jobs}</div>
      <div class="heartbeat">Last seen: ${lastSeen}</div>
    `;
    grid.appendChild(card);
  });
}

async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders?limit=50`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const orders = await res.json();
    updateOrdersTable(orders);
  } catch (e) {
    console.error('Orders fetch error:', e);
    document.getElementById('orders-body').innerHTML =
      '<tr><td colspan="5" class="loading-row">Failed to load orders</td></tr>';
  }
}

function updateOrdersTable(orders) {
  const tbody = document.getElementById('orders-body');
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  orders.forEach(o => {
    const tr = document.createElement('tr');
    const createdAt = new Date(o.created_at).toLocaleString();
    const receiptUrl = `${API_BASE}/receipts/${o.id}`;

    tr.innerHTML = `
      <td><code>${o.id.slice(0, 8)}...</code></td>
      <td>${escapeHtml(o.customer_name)}</td>
      <td><span class="status-tag ${o.status}">${o.status}</span></td>
      <td><a href="${receiptUrl}" class="receipt-link ${o.status === 'completed' ? '' : 'pending'}"
             target="_blank" ${o.status !== 'completed' ? 'aria-disabled="true"' : ''}>
        ${o.status === 'completed' ? 'Download' : 'Pending'}
      </a></td>
      <td>${createdAt}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const btn = document.getElementById('submit-btn');

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer ' + (window.__API_TOKEN__ || '')
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to create order');
    }

    const order = await res.json();
    showAlert(`Order ${order.id.slice(0, 8).toUpperCase()} created successfully!`, 'success');
    form.reset();
    fetchDashboard();
    fetchOrders();
  } catch (err) {
    showAlert('Failed to create order: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Order';
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

fetchDashboard();
fetchOrders();
setInterval(fetchDashboard, 5000);
setInterval(fetchOrders, 10000);
