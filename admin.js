/* =========================================
   অ্যাডম প্যানেল — জাভাস্ক্রিপ্ট (বাংলা)
   ডাটা localStorage-এ সেভ হয় (ডেমো)। প্রোডাকশনে ব্যাকএন্ড API জড় করুন।
   ========================================= */

const STORAGE_KEYS = {
  products: 'admin_products',
  settings: 'admin_settings',
  session:  'admin_session'
};

// নিয়ন ডাটা এপি URL (অর্ডার ডাটাবেস থেকে পড়া ও লেখা)
const NEON_API = 'https://ep-dark-violet-azkly0ww.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1';

// সহজ সেশন (প্রোডাকশনে সার্ভার-সাইড-auth ব্যবহার করুন)
const AdminAuth = {
  isLoggedIn() { return !!localStorage.getItem(STORAGE_KEYS.session); },
  login() { localStorage.setItem(STORAGE_KEYS.session, '1'); },
  logout() { localStorage.removeItem(STORAGE_KEYS.session); location.href = 'admin-login.html'; }
};

// ডাটা লேயার
const Store = {
  // পণ্য (নियন ডাটাবেসে সেভ, লোকালস্টোরেজে ফলব্যাক)
  async getProducts() {
    try {
      const res = await fetch(NEON_API + '/products?order=created_at.desc', { cache: 'no-store' });
      if (!res.ok) throw new Error('নিযন পণ্য ত্রুটি');
      const data = await res.json();
      return (data.data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        stock: p.stock,
        image: p.image,
        createdAt: p.created_at
      }));
    } catch (e) {
      console.error('নিযন থেকে পণ্য পড়তে সমস্যা:', e);
      try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]'); }
      catch { return []; }
    }
  },
  async addProduct(p) {
    try {
      const res = await fetch(NEON_API + '/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'prod_' + Date.now(),
          name: p.name,
          price: p.price,
          description: p.description,
          stock: p.stock,
          image: p.image,
          created_at: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error('পণ্য সেভ ব্যর্থ');
      const data = await res.json();
      return (data.data || [null])[0] || p;
    } catch (e) {
      console.error('নিযনে পণ্য সেভ করতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      const ps = this.getProductsLocal();
      p.id = 'prod_' + Date.now();
      p.createdAt = new Date().toISOString();
      ps.push(p);
      this.saveProductsLocal(ps);
      return p;
    }
  },
  async updateProduct(id, patch) {
    try {
      const filter = 'id:eq:' + id;
      const res = await fetch(NEON_API + '/products?filter=' + encodeURIComponent(filter), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error('অপডেট ব্যর্থ');
      const data = await res.json();
      return (data.data || [null])[0] || null;
    } catch (e) {
      console.error('পণ্য অপডেট করতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      const ps = this.getProductsLocal();
      const idx = ps.findIndex(x => x.id === id);
      if (idx === -1) return null;
      ps[idx] = { ...ps[idx], ...patch };
      this.saveProductsLocal(ps);
      return ps[idx];
    }
  },
  async deleteProduct(id) {
    try {
      const filter = 'id:eq:' + id;
      await fetch(NEON_API + '/products?filter=' + encodeURIComponent(filter), {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('পণ্য মুছতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      let ps = this.getProductsLocal();
      ps = ps.filter(x => x.id !== id);
      this.saveProductsLocal(ps);
    }
  },

  // লোকালস্টোরেজ হেলপার (ফলব্যাকের জন্য)
  getProductsLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]'); }
    catch { return []; }
  },
  saveProductsLocal(products) { localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products)); },

  // অর্ডার (নিয়ন ডাটাবেস থেকে পঠে/লিখে)
  async getOrders() {
    try {
      const res = await fetch(NEON_API + '/orders?order=created_at.desc', { cache: 'no-store' });
      if (!res.ok) throw new Error('নিয়ন ডাটা এপি ত্রুটি');
      const data = await res.json();
      return (data.data || []).map(o => ({
        id: o.id,
        customerName: o.customer_name,
        phone: o.phone,
        address: o.address,
        totalAmount: o.total_amount,
        invoiceId: o.invoice_id,
        status: o.status,
        createdAt: o.created_at
      }));
    } catch (e) {
      console.error('নியন থেকে অর্ডার পড়তে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      try { return JSON.parse(localStorage.getItem('admin_orders') || '[]'); }
      catch { return []; }
    }
  },
  async addOrder(order) {
    try {
      await fetch(NEON_API + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id || 'ord_' + Date.now(),
          customer_name: order.customerName || order.name,
          phone: order.phone,
          address: order.address,
          total_amount: order.totalAmount || order.totalAmount,
          invoice_id: order.invoiceId,
          status: order.status || 'pending',
          created_at: order.createdAt || new Date().toISOString()
        })
      });
      return order;
    } catch (e) {
      console.error('নিয়নে অর্ডার সেভ করতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      try {
        const key = 'admin_orders';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        order.id = order.id || 'ord_' + Date.now();
        order.createdAt = order.createdAt || new Date().toISOString();
        order.status = order.status || 'pending';
        existing.push(order);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (saveErr) { console.error('অর্ডার সেভ করতে সমস্যা:', saveErr); }
      return order;
    }
  },
  async updateOrder(id, patch) {
    try {
      const filter = 'id:eq:' + id;
      const res = await fetch(NEON_API + '/orders?filter=' + encodeURIComponent(filter), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error('অপডেট ব্যর্থ');
      const data = await res.json();
      return (data.data || [null])[0] || null;
    } catch (e) {
      console.error('অর্ডার অপডেট করতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      try {
        const os = JSON.parse(localStorage.getItem('admin_orders') || '[]');
        const idx = os.findIndex(x => x.id === id);
        if (idx === -1) return null;
        os[idx] = { ...os[idx], ...patch };
        localStorage.setItem('admin_orders', JSON.stringify(os));
        return os[idx];
      } catch { return null; }
    }
  },
  async deleteOrder(id) {
    try {
      const filter = 'id:eq:' + id;
      await fetch(NEON_API + '/orders?filter=' + encodeURIComponent(filter), {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('অর্ডার মুছতে সমস্যা:', e);
      // ফলব্যাক: লোকালস্টোরেজ
      try {
        let os = JSON.parse(localStorage.getItem('admin_orders') || '[]');
        os = os.filter(x => x.id !== id);
        localStorage.setItem('admin_orders', JSON.stringify(os));
      } catch { }
    }
  }
};

// ইউটিলিটি
const Utils = {
  bnDigits(n) {
    const d = '০১২৩৪৫৬৭৮৯';
    return n.toString().replace(/\d/g, ch => d[ch]);
  },
  formatMoney(taka) {
    return this.bnDigits(taka) + ' টাকা';
  },
  statusLabel(s) {
    const map = {
      pending: 'প্যান্ডিং', processing: 'প্রসেসিং', shipped: 'শিপ করা হয়েছে',
      delivered: 'ডেলিভার্ড', returned: 'রিটার্ন', cancelled: 'বাতিল'
    };
    return map[s] || s;
  },
  statusClass(s) {
    return 'badge ' + (s || 'pending');
  },
  generateId(prefix = 'id') { return prefix + '_' + Date.now(); }
};

// আইপি-ভিত্তি ২৪ ঘণ্টায় একবার অর্ডার সীমাবদ্ধতা (ডেমো: পাবলিক আইপি Fetch করে)
// প্রোডাকশনে এটিকে সার্ভার-সাইডে রিকোয়েস্ট হেডার থেকে নিতে হবে।
const RateLimiter = {
  async getIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const data = await res.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  },
  keyFor(ip) { return 'rate_order_' + ip; },
  canOrder(ip) {
    const raw = localStorage.getItem(this.keyFor(ip));
    if (!raw) return true;
    const last = parseInt(raw, 10);
    return (Date.now() - last) >= 24 * 60 * 60 * 1000;
  },
  hoursLeft(ip) {
    const raw = localStorage.getItem(this.keyFor(ip));
    if (!raw) return 0;
    const passed = Date.now() - parseInt(raw, 10);
    const left = 24 * 60 * 60 * 1000 - passed;
    return Math.max(0, Math.ceil(left / (60 * 60 * 1000)));
  },
  markOrder(ip) { localStorage.setItem(this.keyFor(ip), Date.now().toString()); }
};

// পেজ লোডে অথ চেক (লগিন পেজ বাদে)
function requireAuth() {
  const page = location.pathname.split('/').pop() || '';
  if (page === 'admin-login.html') return;
  if (!AdminAuth.isLoggedIn()) location.href = 'admin-login.html';
}
// ---------- ড্যাশবোর্ড স্ট্যাটস ----------
async function renderDashboard() {
  const products = await Store.getProducts();
  const orders   = await Store.getOrders();

  const totalProducts = products.length;
  const totalOrders   = orders.length;
  const totalRevenue  = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
  const delivered     = orders.filter(o => o.status === 'delivered').length;
  const courierRatio  = totalOrders ? Math.round((delivered / totalOrders) * 100) : 0;

  document.getElementById('stat-products').textContent = Utils.bnDigits(totalProducts);
  document.getElementById('stat-orders').textContent   = Utils.bnDigits(totalOrders);
  document.getElementById('stat-revenue').textContent  = Utils.formatMoney(totalRevenue);
  document.getElementById('stat-courier').textContent  = Utils.bnDigits(courierRatio) + '%';

  // আক্ষরিক ordres তালিকা (সর্বশেষ ৫)
  const recent = orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">কোনো অর্ডার নেই</td></tr>';
    return;
  }
  for (const o of recent) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${o.id.replace('ord_','')}</td>
      <td>${o.customerName || '—'}</td>
      <td>${o.phone || '—'}</td>
      <td>${Utils.formatMoney(o.totalAmount || 0)}</td>
      <td><span class="${statusClass(o.status)}">${statusLabel(o.status)}</span></td>
    `;
    tbody.appendChild(tr);
  }
}
// ---------- অর্ডার তালিকা ----------
async function renderOrders() {
  const orders = (await Store.getOrders()).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">কোনো অর্ডার পাওয়া যায়নি</td></tr>';
    return;
  }
  for (const o of orders) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${o.id.replace('ord_','')}</td>
      <td>${o.customerName || '—'}</td>
      <td>${o.phone || '—'}</td>
      <td>${o.address ? o.address.slice(0, 30) + (o.address.length > 30 ? '...' : '') : '—'}</td>
      <td>${Utils.formatMoney(o.totalAmount || 0)}</td>
      <td><span class="${statusClass(o.status)}">${statusLabel(o.status)}</span></td>
      <td>
        <a href="admin-order-details.html?id=${o.id}" class="btn btn-sm btn-outline">বিস্তারিত</a>
        <select class="status-select" data-id="${o.id}" style="padding:4px 8px;font-size:0.85rem;border-radius:6px;border:1px solid var(--border);">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>প্যান্ডিং</option>
          <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>প্রসেসিং</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>শিপ করা হয়েছে</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>ডেলিভার্ড</option>
          <option value="returned" ${o.status === 'returned' ? 'selected' : ''}>রিটার্ন</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>বাতিল</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      await Store.updateOrder(id, { status: e.target.value });
      renderOrders();
    });
  });
}

// ---------- অর্ডার বিবরণ ----------
async function renderOrderDetails() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const orders = await Store.getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) { document.body.innerHTML = '<div class="empty-state"><h2>অর্ডার পাওয়া যায়নি</h2><a href="admin-orders.html" class="btn btn-primary">তালিকায় ফিরে যান</a></div>'; return; }

  document.getElementById('order-id').textContent   = '#' + order.id.replace('ord_', '');
  document.getElementById('order-name').textContent  = order.customerName || '—';
  document.getElementById('order-phone').textContent = order.phone || '—';
  document.getElementById('order-email').textContent = order.email || '—';
  document.getElementById('order-address').textContent = order.address || '—';
  document.getElementById('order-postcode').textContent = order.postcode || '—';
  document.getElementById('order-quantity').textContent = Utils.bnDigits(order.quantity || 1);
  document.getElementById('order-total').textContent   = Utils.formatMoney(order.totalAmount || 0);
  document.getElementById('order-status').textContent  = statusLabel(order.status);
  document.getElementById('order-status').className = statusClass(order.status);
  document.getElementById('order-date').textContent    = new Date(order.createdAt).toLocaleString('bn-BD');

  const statusSel = document.getElementById('detail-status');
  statusSel.value = order.status || 'pending';
  statusSel.addEventListener('change', async () => {
    await Store.updateOrder(id, { status: statusSel.value });
    location.reload();
  });

  document.getElementById('btn-delete-order').addEventListener('click', async () => {
    if (confirm('এই অর্ডারটি মুছতে চান?')) {
      await Store.deleteOrder(id);
      location.href = 'admin-orders.html';
    }
  });
}

// ---------- অর্ডার তৈরি ----------
function initCreateOrder() {
  const form = document.getElementById('create-order-form');
  if (!form) return;

  const ipDisplay = document.getElementById('ip-display');
  const rateMsg = document.getElementById('rate-msg');
  const submitBtn = document.getElementById('submit-order');

  RateLimiter.getIP().then(ip => {
    ipDisplay.textContent = ip;
    if (!RateLimiter.canOrder(ip)) {
      const hrs = RateLimiter.hoursLeft(ip);
      rateMsg.textContent = 'এই আইপি থেকে শেষ ২৪ ঘণ্টায় অর্ডার করা হয়েছে। ' + hrs + ' ঘণ্টা পরে আবার চেষ্টা করুন।';
      rateMsg.style.color = 'var(--danger)';
      submitBtn.disabled = true;
    } else {
      rateMsg.textContent = 'আপনি অর্ডার করতে পারবেন।';
      rateMsg.style.color = 'var(--accent)';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!RateLimiter.canOrder(ipDisplay.textContent || 'unknown')) {
      alert('২৪ ঘণ্টায় একবারই অর্ডার করা যাবে।');
      return;
    }
    const order = {
      customerName: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      address: form.address.value.trim(),
      postcode: form.postcode.value.trim(),
      quantity: parseInt(form.quantity.value, 10) || 1,
      totalAmount: parseFloat(form.totalAmount.value) || 0,
      status: form.status.value,
      paymentMethod: 'cash_on_delivery',
      ip: ipDisplay.textContent || 'unknown'
    };
    await Store.addOrder(order);
    RateLimiter.markOrder(order.ip);
    alert('অর্ডার সফলভাবে তৈরি হয়েছে!');
    location.href = 'admin-orders.html';
  });
}
// ---------- পণ্য তালিকা ----------
async function renderProducts() {
  const products = (await Store.getProducts()).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const container = document.getElementById('products-container');
  if (!container) return;
  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>কোনো পণ্য যোগ করা হয়নি</p></div>';
    return;
  }
  for (const p of products) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img class="product-img" src="${p.image || 'https://via.placeholder.com/300x200?text=NO_IMAGE'}" alt="${p.name || 'পণ্য'}">
      <div class="product-body">
        <div class="product-title">${p.name || 'বেনামে পণ্য'}</div>
        <div class="product-price">${Utils.formatMoney(p.price || 0)}</div>
        <div style="margin-top:auto; display:flex; gap:0.5rem;">
          <a href="admin-product-edit.html?id=${p.id}" class="btn btn-sm btn-primary">সম্পাদনা</a>
          <button class="btn btn-sm btn-danger" onclick="if(confirm('মুছতে চান?')){Store.deleteProduct('${p.id}'); renderProducts();}">মুছুন</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// ---------- পণ্য যোগ / সম্পাদনা ----------
async function initProductForm() {
  const form = document.getElementById('product-form');
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isEdit = !!id;

  if (isEdit) {
    const products = await Store.getProducts();
    const p = products.find(x => x.id === id);
    if (!p) { location.href = 'admin-products.html'; return; }
    form.name.value = p.name || '';
    form.price.value = p.price || '';
    form.description.value = p.description || '';
    form.stock.value = p.stock || '';
    form.image.value = p.image || '';
    document.getElementById('page-title').textContent = 'পণ্য সম্পাদনা';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: form.name.value.trim(),
      price: parseFloat(form.price.value) || 0,
      description: form.description.value.trim(),
      stock: parseInt(form.stock.value, 10) || 0,
      image: form.image.value.trim()
    };
    if (isEdit) {
      await Store.updateProduct(id, data);
    } else {
      await Store.addProduct(data);
    }
    location.href = 'admin-products.html';
  });
}

// ---------- কুরিয়ার র্যাশিও ----------
async function renderCourier() {
  const orders = await Store.getOrders();
  const total = orders.length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const pending   = orders.filter(o => o.status === 'pending').length;
  const shipped   = orders.filter(o => o.status === 'shipped').length;
  const returned  = orders.filter(o => o.status === 'returned').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;

  const ratio = total ? Math.round((delivered / total) * 100) : 0;

  document.getElementById('courier-total').textContent   = Utils.bnDigits(total);
  document.getElementById('courier-delivered').textContent = Utils.bnDigits(delivered);
  document.getElementById('courier-pending').textContent   = Utils.bnDigits(pending);
  document.getElementById('courier-shipped').textContent   = Utils.bnDigits(shipped);
  document.getElementById('courier-returned').textContent  = Utils.bnDigits(returned);
  document.getElementById('courier-cancelled').textContent = Utils.bnDigits(cancelled);
  document.getElementById('courier-ratio').textContent     = Utils.bnDigits(ratio) + '%';
  document.getElementById('ratio-fill').style.width = ratio + '%';
}

// ---------- শুরু ----------
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  if (document.getElementById('stat-products')) renderDashboard();
  if (document.getElementById('orders-body')) renderOrders();
  if (document.getElementById('order-id')) renderOrderDetails();
  if (document.getElementById('create-order-form')) initCreateOrder();
  if (document.getElementById('products-container')) renderProducts();
  if (document.getElementById('product-form')) initProductForm();
  if (document.getElementById('courier-total')) renderCourier();

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => AdminAuth.logout());
});