/* =========================================
   পণ্য ল্যান্ডিং পেজ — জাভাস্ক্রিপ্ট
   নোট: এখানে আপনার স্টেডফাস্ট API ক্রেডেনশিয়াল ও পিক্সেল আইডি বসান
   ========================================= */

// ---------- configure (EDIT THESE) ----------
const CONFIG = {
  // ফেসবুক পিক্সেল আইডি (ইনডেক্স হটএমএলে একই আইডি দিন)
  pixelId: 'আপনার_পিক্সেল_আইডি_এখানে',

  // স্টেডফাস্ট মার্চেন্ট API ক্রেডেনশিয়াল — আপনার স্টেডফাস্ট ড্যাশবোর্ড থেকে নেবেন
  steadfast: {
    apiKey: 'আপনার_স্টেডফাস্ট_API_কী',
    secretKey: 'আপনার_স্টেডফাস্ট_সিক্রেট_কী',
    merchantId: 'আপনার_মার্চেন্ট_আইডি',
    // বেস URL ও এন্ডপয়েন্ট স্টেডফাস্টের অফিশিয়াল ডকুমেন্টেশন অনুযায়ী সেট করুন
    baseUrl: 'https://api.steadfast.com.bd', // প্লেসহোল্ডার — অফিশিয়াল ডক নিন
    endpoint: '/v1/create-order'              // প্লেসহোল্ডার — অফিশিয়াল ডক নিন
  },

  // পণ্যের দাম (টাকা)
  productPrice: 1999,
  deliveryCharge: 60,
  productName: 'প্রিমিয়াম পণ্য',

  // নিয়ন ডাটা এপি (নিয়ো ডাটাবেস থেকে অর্ডার সেভ ও পড়া)
  neon: {
    baseUrl: 'https://ep-dark-violet-azkly0ww.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1'
  }
};

// ---------- ফেসবুক পিক্সেল হেল্পার ----------
const Pixel = {
  init() {
    // ইনডেক্স হটএমএলে PageView ট্র্যাক হয়েছে
  },
  track(eventName, params = {}) {
    if (window.fbq) {
      window.fbq('track', eventName, params);
      console.log('[Pixel]', eventName, params);
    } else {
      console.warn('[Pixel] fbq লোড নেই');
    }
  },
  trackLead() {
    this.track('Lead', {
      content_name: CONFIG.productName,
      content_category: 'product',
      value: CONFIG.productPrice + CONFIG.deliveryCharge,
      currency: 'BDT'
    });
  },
  trackPurchase(orderId) {
    this.track('Purchase', {
      value: CONFIG.productPrice + CONFIG.deliveryCharge,
      currency: 'BDT',
      order_id: orderId,
      content_name: CONFIG.productName
    });
  }
};
// ---------- প্রতারক যাচাইকারী (Fraud Checker) ----------
const FraudChecker = {
  // বাংলাদেশের ফোন নম্বর নরমালাইজ: ০১৭১২৩৪৫৬৭৮ → 01712345678, +8801712345678 → 01712345678
  normalizePhone(phone) {
    // বাঙলা ডিজিটকে ইংরেজিতে রূপান্তর (০১৮ → 018)
    const bnToEn = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    let p = phone.replace(/[০-৯]/g, ch => bnToEn[ch]).replace(/\D/g, '');
    if (p.startsWith('880') && p.length === 14) p = '0' + p.slice(3);
    if (p.startsWith('00880') && p.length === 15) p = '0' + p.slice(4);
    return p;
  },

  validatePhone(phone) {
    const p = this.normalizePhone(phone);
    const re = /^01[3-9]\d{8}$/;
    return { valid: re.test(p), normalized: p };
  },

  // সন্দেহজনক প্যাটার্ন শনাক্ত
  checkSuspicious(data) {
    const reasons = [];
    let score = 0;

    const phoneRes = this.validatePhone(data.phone);
    if (!phoneRes.valid) {
      reasons.push('ফোন নম্বর সঠিক নয় (১১ ডিজিট, ০১৩-০১৯ দিয়ে শুরু হতে হবে)');
      score += 40;
    }

    // একই ডিজিট পুনরাবৃত্তি (যেমন ০১১১১১১১১১১)
    if (/^(\d)\1{10}$/.test(phoneRes.normalized)) {
      reasons.push('ফোন নম্বরে একই ডিজিট বারবার আছে — সন্দেহজনক');
      score += 30;
    }

    // নাম খুব ছোট বা শুধু সংখ্যা
    if (!data.name || data.name.trim().length < 2) {
      reasons.push('নাম খুব ছোট');
      score += 20;
    }
    if (/^\d+$/.test(data.name || '')) {
      reasons.push('নামে শুধু সংখ্যা আছে');
      score += 20;
    }

    // ঠিকানা খুব ছোট
    if (!data.address || data.address.trim().length < 10) {
      reasons.push('ঠিকানা খুব ছোট — সম্পূর্ণ ঠিকানা দিন');
      score += 25;
    }

    // খুব দ্রুত একাধিক অর্ডার (ক্লায়েন্ট-সাইড সংকেত — সার্ভারে যাচাই করুন)
    const lastOrder = localStorage.getItem('last_order_time');
    const now = Date.now();
    if (lastOrder && now - parseInt(lastOrder, 10) < 60000) {
      reasons.push('ধীরে করুন, সরাসরি একাধিক অর্ডার সন্দেহজনক');
      score += 15;
    }

    return { score, reasons, risky: score >= 40 };
  }
};

// ---------- স্টেডফাস্ট API ক্লায়েন্ট ----------
const Steadfast = {
  async bookParcel(order) {
    // ⚠️ নোট: স্টেডফাস্টের প্রকৃত এন্ডপয়েন্ট, হেডার নাম ও ফিল্ড নাম তাদের অফিশিয়াল মার্চেন্ট API ডকুমেন্টেশন থেকে নিতে হবে।
    // নিচে একটি illustrative উদাহরণ দেওয়া হয়েছে — লাইভ করার আগে আপনার ক্রেডেনশিয়াল ও পেলোড নিশ্চিত করুন।

    const url = CONFIG.steadfast.baseUrl + CONFIG.steadfast.endpoint;
    const headers = {
      'Content-Type': 'application/json',
      'Api-Key': CONFIG.steadfast.apiKey,        // প্লেসহোল্ডার হেডার নাম
      'Secret-Key': CONFIG.steadfast.secretKey,   // প্লেসহোল্ডার হেডার নাম
      'Merchant-Id': CONFIG.steadfast.merchantId  // প্লেসহোল্ডার হেডার নাম
    };

    const payload = {
      invoice_id: order.invoiceId,
      customer_name: order.name,
      customer_phone: order.phone,
      customer_address: order.address,
      cod_amount: order.totalAmount,
      product_name: CONFIG.productName,
      delivery_charge: CONFIG.deliveryCharge
    };

    console.log('[Steadfast] Request payload (প্রোডাকশনে ক্রেডেনশিয়াল এনভি-ভ্যারিয়েবল থেকে নেবেন):', {
      ...payload,
      apiKey: '***',
      secretKey: '***'
    });

    // ডেভেলপমেন্টে নেটওয়ার্ক কল স্কিপ করুন যদি ক্রেডেনশিয়াল প্লেসহোল্ডার থাকে
    if (CONFIG.steadfast.apiKey.includes('আপনার')) {
      console.log('[Steadfast] ক্রেডেনশিয়াল সেট না হওয়ায় মক রেসপন্স রিটার্ন করছে');
      return { ok: true, mock: true, trackingId: 'MOCK-' + Date.now(), message: 'মোড: ক্রেডেনশিয়াল সেট না থাকায় অর্ডার নথিভুক্ত হয়নি' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('স্টেডফাস্ট API এরর (' + res.status + '): ' + errText);
    }

    return await res.json();
  }
};
// ---------- অর্ডার ফর্ম হ্যান্ডলার ----------
const OrderForm = {
  elements: null,
  btnText: null,
  btnLoader: null,
  messageBox: null,

  init() {
    this.elements = {
      name: document.getElementById('name'),
      phone: document.getElementById('phone'),
      address: document.getElementById('address')
    };
    this.btnText = document.getElementById('btn-text');
    this.btnLoader = document.getElementById('btn-loader');
    this.messageBox = document.getElementById('form-message');

    const form = document.getElementById('order-form');
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    this.updateSummary();

    // রিভিল অ্যানিমেশন
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // মোবাইল মেনু
    const toggle = document.getElementById('menu-toggle');
    const links = document.querySelector('.nav-links');
    toggle.addEventListener('click', () => links.classList.toggle('active'));
  },

  updateSummary() {
    const total = CONFIG.productPrice + CONFIG.deliveryCharge;
    document.getElementById('summary-total').textContent = this.toBangla(total) + ' টাকা';
  },

  toBangla(n) {
    const bnDigits = '০১২৩৪৫৬৭৮৯';
    return n.toString().replace(/\d/g, d => bnDigits[d]);
  },

  showMessage(type, text) {
    this.messageBox.textContent = text;
    this.messageBox.className = 'form-message ' + type;
    this.messageBox.style.display = 'block';
    setTimeout(() => { this.messageBox.style.display = 'none'; }, 8000);
  },

  setLoading(loading) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = loading;
    this.btnText.style.display = loading ? 'none' : 'inline';
    this.btnLoader.style.display = loading ? 'inline' : 'none';
  },

  clearErrors() {
    ['name', 'phone', 'address'].forEach(id => {
      document.getElementById('err-' + id).textContent = '';
    });
  },

  async handleSubmit(e) {
    e.preventDefault();
    this.clearErrors();
    this.setLoading(true);

    // ২৪ ঘণ্টা সীমাবদ্ধতা চেক
    const last = parseInt(localStorage.getItem('cod_last_order_time') || '0', 10);
    const now = Date.now();
    const diffHours = (now - last) / (1000 * 60 * 60);
    if (diffHours < 24) {
      const hoursLeft = Math.ceil(24 - diffHours);
      this.showMessage('warn', `২৪ ঘণ্টায় একবার অর্ডার করা যায়। এখনও ${hoursLeft} ঘণ্টা অপেক্ষা করুন।`);
      this.setLoading(false);
      return;
    }

    const data = {
      name: this.elements.name.value.trim(),
      phone: this.elements.phone.value.trim(),
      address: this.elements.address.value.trim()
    };

    const total = CONFIG.productPrice + CONFIG.deliveryCharge;
    data.totalAmount = total;
    data.invoiceId = 'ORD-' + Date.now();

    // ১. প্রতারক চেক
    const fraud = FraudChecker.checkSuspicious(data);
    if (fraud.risky) {
      Pixel.trackLead();
      this.showMessage('warn', fraud.reasons.join('। '));
      this.setLoading(false);
      return;
    }

    // ২. পিক্সেল লিড ট্র্যাক
    Pixel.trackLead();

    try {
      // ৩. স্টেডফাস্টে অর্ডার পাঠানো (প্রোডাকশনে আনকমেন্ট করুন)
      // const result = await Steadfast.bookParcel(data);
      // console.log('[Steadfast] Response:', result);

      localStorage.setItem('cod_last_order_time', Date.now().toString());

      // অর্ডার नियন ডাটাবেসে সেভ করা (অ্যাডম প্যানেলে দেখাবে)
      try {
        await fetch(CONFIG.neon.baseUrl + '/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.invoiceId,
            customer_name: data.name,
            phone: data.phone,
            address: data.address,
            total_amount: data.totalAmount,
            invoice_id: data.invoiceId,
            status: 'pending'
          })
        });
      } catch (neonErr) {
        console.error('নিয়নে অর্ডার সেভ করতে সমস্যা:', neonErr);
        // ফলব্যাক: লোকালস্টোরেজে সেভ
        try {
          const key = 'admin_orders';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push({
            id: 'ord_' + Date.now(),
            customerName: data.name,
            phone: data.phone,
            address: data.address,
            totalAmount: data.totalAmount,
            invoiceId: data.invoiceId,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (saveErr) { console.error('অর্ডার সেভ করতে সমস্যা:', saveErr); }
      }

      Pixel.trackPurchase(data.invoiceId);

      this.showMessage('success', 'অর্ডার সফলভাবে প্লেস হয়েছে! আমরা দ্রুত আপনার সাথে যোগাযোগ করব। পণ্য হাতে পাওয়ার পর টাকা দিয়ে নেবেন।');
      document.getElementById('order-form').reset();
      this.updateSummary();
    } catch (err) {
      console.error(err);
      this.showMessage('error', 'অর্ডার প্লেস করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      this.setLoading(false);
    }
  }
};

// ---------- পণ্য ডাটা (অ্যাডম থেকে যোগ করা পণ্য ওয়েবসাইটে দেখাবে) ----------
const ProductCatalog = {
  neonBase: CONFIG.neon.baseUrl,

  async fetchProducts() {
    try {
      const res = await fetch(this.neonBase + '/products?order=created_at.desc&limit=50', { cache: 'no-store' });
      if (!res.ok) throw new Error('নিয়ন পণ্য লোড ত্রুটি');
      const data = await res.json();
      return (data.data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        stock: p.stock || 0,
        image: p.image || 'https://via.placeholder.com/400x300?text=পণ্যের_ছবি'
      }));
    } catch (e) {
      console.error('নিয়ন থেকে পণ্য পড়তে সমস্যা:', e);
      try {
        const ps = JSON.parse(localStorage.getItem('admin_products') || '[]');
        return ps.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          stock: p.stock || 0,
          image: p.image || 'https://via.placeholder.com/400x300?text=পণ্যের_ছবি'
        }));
      } catch { return []; }
    }
  },

  renderProducts(products) {
    const container = document.getElementById('product-grid');
    if (!container) return;
    if (!products || products.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <svg style="width:80px;height:80px;opacity:0.4;margin-bottom:1rem;"><circle cx="50%" cy="50%" r="30" stroke="#d1d5db" stroke-width="2" fill="none"/></svg>
          <p>এখন পর্যন্ত কোনো পণ্য যোগ করা হয়নি।</p>
          <a href="/admin-products.html" class="btn btn-primary btn-sm" style="margin-top:1rem;display:inline-block;">অ্যাডম প্যানেল থেকে পণ্য যোগ করুন</a>
        </div>
      `;
      return;
    }
    container.innerHTML = products.map(p => `
      <div class="product-card-viewer">
        <img src="${p.image || 'https://via.placeholder.com/400x300?text=পণ্যের_ছবি'}" alt="${p.name}" class="product-img-viewer" onerror="this.src='https://via.placeholder.com/400x300?text=পণ্যের_ছবি'">
        <div class="product-body-viewer">
          <div class="product-title-viewer">${this.escapeHtml(p.name)}</div>
          <div class="product-price-viewer">${this.toBangla(p.price)} টাকা</div>
          ${p.description ? `<p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem;">${this.escapeHtml(p.description)}</p>` : ''}
          ${p.stock <= 0 ? `<p style="color:var(--danger);">😔 স্টক শেষ</p>` : `<p style="color:var(--text-muted);">${p.stock}টি আছে</p>`}
          <button class="btn-order-product" data-price="${p.price}" data-name="${this.escapeHtml(p.name)}" onclick="LocationTracker.trackProduct(this)">
            🎁 আমি এটা অর্ডার করব
          </button>
        </div>
      </div>
    `).join('');
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  toBangla(n) {
    const bn = '০১২৩৪৫৬৭৮৯';
    return n.toString().replace(/\\d/g, d => bn[d]);
  }
};

// ---------- অর্ডার ট্র্যাকিং ----------
const LocationTracker = {
  neonBase: CONFIG.neon.baseUrl,

  trackProduct(btn) {
    const price = parseFloat(btn.dataset.price);
    const name = btn.dataset.name;
    btn.textContent = '📋 অর্ডার প্রস্তুত...';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '✅ অর্ডারে যান'; btn.disabled = false; }, 1500);
  },

  async searchOrder(query) {
    const trimmed = query.trim();
    if (!trimmed) { document.getElementById('track-result').style.display = 'none'; return; }

    try {
      const res = await fetch(this.neonBase + '/orders?filter=invoice_id:eq:' + encodeURIComponent(trimmed) + ' OR phone:eq:' + encodeURIComponent(trimmed), { cache: 'no-store' });
      if (!res.ok) throw new Error('লোকেশন ধরতে ত্রুটি');
      const data = await res.json();
      const orders = (data.data || []).map(o => ({
        id: o.id,
        invoiceId: o.invoice_id || o.id,
        customerName: o.customer_name,
        phone: o.phone,
        address: o.address,
        totalAmount: o.total_amount,
        status: o.status,
        createdAt: o.created_at
      }));

      const resultEl = document.getElementById('track-result');
      if (orders.length === 0) {
        resultEl.innerHTML = `<p style="color:var(--text-muted);">🎯 কোনো অর্ডার পাওয়া যায়নি। ইনভয়েস নম্বর বা ফোন নম্বর আবার চেক করুন।</p>`;
        resultEl.style.display = 'block';
        return;
      }

      const order = orders[0];
      const statusLabel = {
        pending: '📋 প্যান্ডিং',
        processing: '🔄 প্রসেসিং',
        shipped: '🚚 শিপ করা হয়েছে',
        delivered: '✅ ডেলিভার্ড',
        returned: '🔄 রিটার্ন',
        cancelled: '❌ বাতিল'
      };

      const statusColor = {
        pending: 'track-status pending',
        processing: 'track-status processing',
        shipped: 'track-status shipped',
        delivered: 'track-status delivered',
        returned: 'track-status returned',
        cancelled: 'track-status cancelled'
      };

      resultEl.innerHTML = `
        <h3>🎉 অর্ডার পেয়েছেন!</h3>
        <p><strong>ইনভয়েস নম্বর:</strong> ${this.escapeHtml(order.invoiceId)}</p>
        <p><strong>পেট্রিং:</strong> ${this.escapeHtml(order.customerName)}</p>
        <p><strong>ফোন:</strong> ${this.escapeHtml(order.phone)}</p>
        <p><strong>ঠিকানা:</strong> ${this.escapeHtml(order.address)}</p>
        <p><strong>মোট টাকা:</strong> ${this.toBangla(order.totalAmount)} টাকা</p>
        <p><strong>স্ট্যাটাস:</strong> <span class="${statusColor[order.status] || 'track-status pending'}">${statusLabel[order.status] || 'প্যান্ডিং'}</span></p>
        <p><strong>অর্ডার তৈরি:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString('bn-BD') : '—'}</p>
      `;
      resultEl.style.display = 'block';
    } catch (e) {
      console.error('অর্ডার খুঁজতে সমস্যা:', e);
      const resultEl = document.getElementById('track-result');
      resultEl.innerHTML = `<p style="color:#991b1b;">⚠️ অর্ডার খুঁজতে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।</p>`;
      resultEl.style.display = 'block';
    }
  },

  toBangla(n) {
    const bn = '০১২৩৪৫৬৭৮৯';
    return n.toString().replace(/\\d/g, d => bn[d]);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ---------- ডোম রেডি ----------
document.addEventListener('DOMContentLoaded', async () => {
  Pixel.init();

  // অর্ডার ফর্ম ইনিশিয়ালাইজ (order-form)
  if (document.getElementById('order-form')) {
    OrderForm.init();
  }

  // পণ্য ক্যাটালগ লোড
  const products = await ProductCatalog.fetchProducts();
  ProductCatalog.renderProducts(products);

  // অর্ডার ট্র্যাকিং
  const trackForm = document.getElementById('track-form');
  if (trackForm) {
    trackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('track-query').value.trim();
      document.getElementById('track-btn').disabled = true;
      document.getElementById('track-text').textContent = 'অনুসন্ধান করছে...';
      await LocationTracker.searchOrder(query);
      document.getElementById('track-btn').disabled = false;
      document.getElementById('track-text').textContent = 'অর্ডার খুঁজুন';
    });
  }

  // পুনরায় লোড স্ক্রোলে
  const observer = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const products = await ProductCatalog.fetchProducts();
        ProductCatalog.renderProducts(products);
        entry.target.classList.add('active');
      }
    }
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});
