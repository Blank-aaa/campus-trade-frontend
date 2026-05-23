/**
 * 校园二手交易 - 公共层（API + 工具函数 + 商品详情弹窗）
 * 后端地址: http://localhost:8080
 */
const API_BASE = 'http://localhost:8080';

// ========== 工具函数 ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (str) => str ? String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const fmt = (price) => Number(price || 0).toFixed(2);
const getFirstImage = (images) => images ? images.split(',')[0].trim() : null;
const getAllImages = (images) => images ? images.split(',').map(s => s.trim()).filter(Boolean) : [];
const getUserId = () => localStorage.getItem('ct_uid');
const setUserId = (id) => localStorage.setItem('ct_uid', id);
const isLoggedIn = () => !!getUserId();
const showToast = (msg, type = '') => {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
};

// ========== 通用请求 ==========
async function request(url, options = {}) {
    const config = { headers: { 'Content-Type': 'application/json' }, ...options };
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    try {
        const res = await fetch(fullUrl, config);
        const json = await res.json();
        if (json.code !== 200) throw new Error(json.msg || '请求失败');
        return json.data;
    } catch (err) {
        if (err.message === 'Failed to fetch') throw new Error('网络连接失败，请检查后端服务是否启动');
        throw err;
    }
}

function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const uid = getUserId();
    if (uid) h['userId'] = uid;
    return h;
}

// ========== API ==========
const HomeAPI = {
    banners: () => request('/api/home/banner'),
    hot: () => request('/api/home/hot'),
    search: (keyword, page = 1, size = 10) =>
        request(`/api/home/search?keyword=${encodeURIComponent(keyword || '')}&page=${page}&size=${size}`),
};

const CategoryAPI = {
    list: () => request('/api/category/list'),
    products: (catId, page = 1, size = 10) =>
        request(`/api/category/${catId}/products?page=${page}&size=${size}`),
};

const CartAPI = {
    list: () => request('/api/cart/list', { headers: getHeaders() }),
    add: (productId, qty = 1) => request('/api/cart/add', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ productId, quantity: qty }) }),
    updateQty: (cartId, qty) => request(`/api/cart/${cartId}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ quantity: qty }) }),
    remove: (cartId) => request(`/api/cart/${cartId}`, { method: 'DELETE', headers: getHeaders() }),
};

const UserAPI = {
    info: () => request('/api/user/info', { headers: getHeaders() }),
    updateInfo: (data) => request('/api/user/info', { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }),
    publish: (data) => request('/api/user/publish', { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }),
    published: (page = 1, size = 10) => request(`/api/user/published?page=${page}&size=${size}`, { headers: getHeaders() }),
    updateProduct: (id, data) => request(`/api/user/product/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }),
    offShelf: (id) => request(`/api/user/product/${id}`, { method: 'DELETE', headers: getHeaders() }),
    orders: (status, page = 1, size = 10) => {
        let url = `/api/user/orders?page=${page}&size=${size}`;
        if (status != null) url += `&status=${status}`;
        return request(url, { headers: getHeaders() });
    },
    createOrder: (productId, qty = 1, remark = '') =>
        request('/api/user/order/create', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ productId, quantity: qty, remark }) }),
};

// ========== 商品详情弹窗（公共） ==========
function showProductDetail(productId) {
    const cards = $$('.product-card');
    let product = null;
    for (const card of cards) {
        if (card.dataset.id == productId) {
            const titleEl = card.querySelector('.product-title');
            const descEl = card.querySelector('.product-desc');
            const priceEl = card.querySelector('.product-price');
            const origEl = card.querySelector('.product-original');
            if (titleEl) {
                product = {
                    id: productId,
                    title: titleEl.textContent,
                    description: descEl ? descEl.textContent : '',
                    price: priceEl ? priceEl.textContent.replace('¥','') : '0',
                    originalPrice: origEl ? origEl.textContent.replace('¥','') : null,
                    images: card.querySelector('img') ? card.querySelector('img').src : '',
                };
                break;
            }
        }
    }
    if (!product) { showToast('商品信息获取失败', 'error'); return; }
    showDetailModal(product);
}

function showDetailModal(product) {
    removeModal();
    const images = getAllImages(product.images);
    const firstImg = getFirstImage(product.images);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = e => { if (e.target === overlay) removeModal(); };

    let imgHtml = '';
    if (images.length > 0) {
        imgHtml = images.map((img, i) => `<img src="${esc(img)}" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity 0.3s" onerror="this.style.display='none'" alt="">`).join('');
    } else if (firstImg) {
        imgHtml = `<img src="${esc(firstImg)}" onerror="this.parentElement.innerHTML='<div style=display:flex;align-items:center;justify-content:center;height:100%;font-size:48px>📦</div>'" alt="">`;
    } else {
        imgHtml = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px">📦</div>';
    }

    overlay.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-header"><span style="font-weight:600">商品详情</span><button class="modal-close" onclick="removeModal()">✕</button></div>
        <div class="modal-body">
            <div class="detail-images">${imgHtml}</div>
            <div class="detail-price-row"><span class="detail-price">¥${fmt(product.price)}</span>${product.originalPrice ? `<span class="detail-original">¥${fmt(product.originalPrice)}</span>` : ''}</div>
            <div class="detail-title">${esc(product.title)}</div>
            <div class="detail-meta"><span>👁 ${product.viewCount || 0} 浏览</span></div>
            <div class="detail-desc">${esc(product.description || '暂无描述')}</div>
        </div>
        <div class="detail-actions">
            <button class="btn btn-outline" onclick="addToCart(${product.id})">🛒 加入购物车</button>
            <button class="btn btn-primary" onclick="buyNow(${product.id})">⚡ 立即购买</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
}

function removeModal() { const o = document.querySelector('.modal-overlay'); if (o) o.remove(); }

function addToCart(productId) {
    if (!isLoggedIn()) { showToast('请先登录', 'error'); return; }
    CartAPI.add(productId, 1).then(() => { showToast('已加入购物车', 'success'); removeModal(); }).catch(e => showToast(e.message, 'error'));
}

function buyNow(productId) {
    if (!isLoggedIn()) { showToast('请先登录', 'error'); return; }
    UserAPI.createOrder(productId, 1).then(data => { showToast('购买成功！订单号: ' + data, 'success'); removeModal(); }).catch(e => showToast(e.message, 'error'));
}

function bindProductClicks() {
    $$('.product-card').forEach(card => card.addEventListener('click', () => { if (card.dataset.id) showProductDetail(card.dataset.id); }));
}

// ========== 登录弹窗（公共） ==========
function showLoginModal(callback) {
    removeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = e => { if (e.target === overlay) removeModal(); };
    overlay.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-header"><span style="font-weight:600">登录</span><button class="modal-close" onclick="removeModal()">✕</button></div>
        <div class="modal-body" style="padding-bottom:30px">
            <div style="text-align:center;font-size:48px;margin-bottom:16px">🛒</div>
            <div style="text-align:center;color:var(--text-secondary);margin-bottom:20px;font-size:14px">请输入您的用户ID登录<br><span style="font-size:12px;color:var(--text-muted)">（测试阶段使用数字ID）</span></div>
            <div class="form-group"><label class="form-label">用户ID</label><input class="form-input" id="loginUserId" type="number" placeholder="请输入用户ID，如：1"></div>
            <button class="btn btn-primary btn-block" onclick="doLogin()" style="border-radius:22px;padding:12px;margin-top:8px">登 录</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { const inp = $('#loginUserId'); if (inp) inp.focus(); }, 300);
    window._loginCallback = callback;
}

function doLogin() {
    const userId = $('#loginUserId').value.trim();
    if (!userId) { showToast('请输入用户ID'); return; }
    setUserId(userId);
    removeModal();
    showToast('登录成功', 'success');
    if (window._loginCallback) window._loginCallback();
}

function logout() {
    localStorage.removeItem('ct_uid');
    showToast('已退出登录');
}
