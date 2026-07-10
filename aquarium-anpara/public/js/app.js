const API = '/api';
let token = localStorage.getItem('token');
let sessionId = localStorage.getItem('sessionId') || ('sess_' + Math.random().toString(36).substr(2, 12));
localStorage.setItem('sessionId', sessionId);

const headers = () => {
  const h = { 'Content-Type': 'application/json', 'X-Session-Id': sessionId };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const api = async (url, options = {}) => {
  const res = await fetch(API + url, { headers: headers(), ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const uploadFile = async (file, folder = 'general') => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/upload?folder=${folder}`, {
    method: 'POST',
    headers: { 'X-Session-Id': sessionId, ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
};

// Auth
function setAuth(data) {
  token = data.token;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(data.user));
}
function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}
function logout() {
  token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  fetch(API + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).finally(() => {
    window.location.href = '/';
  });
}
function isLoggedIn() { return !!token; }

// Toast notifications
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  const colors = { success: '#198754', error: '#dc3545', info: '#0d6efd', warning: '#ffc107' };
  const toast = document.createElement('div');
  toast.className = 'toast-custom';
  toast.style.borderLeft = `4px solid ${colors[type]}`;
  toast.innerHTML = `<div class="d-flex align-items-center gap-2">
    <i class="fas fa-${icons[type]}" style="color:${colors[type]}"></i>
    <span>${message}</span>
  </div>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Cart
async function addToCart(productId, qty = 1, btn) {
  try {
    await api('/cart/add', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity: qty }) });
    showToast('Added to cart!');
    updateCartCount();
    if (btn) {
      btn.innerHTML = '<i class="fas fa-shopping-cart me-1"></i>Go to Cart';
      btn.onclick = function() { window.location.href = '/cart'; };
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-success');
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function updateCartCount() {
  try {
    const data = await api('/cart');
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = data.count || 0);
  } catch (e) {}
}

async function removeFromCart(itemId) {
  try {
    await api(`/cart/${itemId}`, { method: 'DELETE' });
    showToast('Removed from cart');
    if (typeof loadCart === 'function') loadCart();
    updateCartCount();
  } catch (e) { showToast(e.message, 'error'); }
}

async function updateCartItem(itemId, qty) {
  try {
    await api(`/cart/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) });
    if (typeof loadCart === 'function') loadCart();
  } catch (e) { showToast(e.message, 'error'); }
}

// Wishlist
async function toggleWishlist(productId) {
  if (!isLoggedIn()) { window.location.href = '/login'; return; }
  try {
    const data = await api('/wishlist', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    showToast(data.message);
    const btn = document.querySelector(`[data-wishlist="${productId}"]`);
    if (btn) btn.innerHTML = data.active ? '<i class="fas fa-heart text-danger"></i>' : '<i class="far fa-heart"></i>';
  } catch (e) { showToast(e.message, 'error'); }
}

// Orders
async function placeOrder(orderData) {
  try {
    const data = await api('/orders', { method: 'POST', body: JSON.stringify(orderData) });
    return data.order;
  } catch (e) { showToast(e.message, 'error'); return null; }
}

// Admin Sidebar Toggle
function toggleAdminSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminSidebarOverlay');
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    const content = document.querySelector('.admin-content');
    if (content) content.classList.toggle('expanded');
  }
}
function closeAdminSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminSidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.remove('open', 'collapsed');
  if (overlay) overlay.classList.remove('open');
  const content = document.querySelector('.admin-content');
  if (content) content.classList.remove('expanded');
}

// WhatsApp
function sendWhatsApp(message) {
  const number = document.body.getAttribute('data-whatsapp') || '919876543210';
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendOrderWhatsApp(order) {
  let msg = `🐠 *New Order - ${order.order_number}*\n\n`;
  msg += `*Customer:* ${order.customer_name}\n`;
  msg += `*Phone:* ${order.customer_phone}\n`;
  msg += `*Address:* ${order.shipping_address}, ${order.shipping_city}, ${order.shipping_state} - ${order.shipping_pincode}\n`;
  msg += `*Payment:* ${order.payment_method.toUpperCase()}\n\n`;
  if (order.items) {
    order.items.forEach(item => {
      msg += `• ${item.product_name} x${item.quantity} = ₹${item.total}\n`;
    });
  }
  msg += `\n*Total: ₹${order.total}*\n`;
  sendWhatsApp(msg);
}

// Search
function handleSearch(e) {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) window.location.href = `/shop?search=${encodeURIComponent(q)}`;
  }
}

// Dark mode
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const icon = document.querySelector('.theme-toggle i');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Scroll animations
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .fade-in-scale').forEach(el => observer.observe(el));
}

// Navbar scroll effect
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const checkScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();
}

// Button ripple effect
function addRippleEffect() {
  document.querySelectorAll('.btn:not(.btn-sm)').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x - size/2}px;
        top: ${y - size/2}px;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: rippleAnim 0.6s ease-out;
        pointer-events: none;
      `;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// Format price
function formatPrice(price) {
  return '₹' + Number(price).toLocaleString('en-IN');
}

// Star rating HTML
function starRating(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rating ? '<i class="fas fa-star"></i>' : (i - 0.5 <= rating ? '<i class="fas fa-star-half-alt"></i>' : '<i class="far fa-star"></i>');
  }
  return html;
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  // Verify token is still valid
  if (token) {
    try {
      const res = await fetch(API + '/auth/me', { headers: headers() });
      if (!res.ok) { logout(); return; }
      const data = await res.json();
      if (!data.user) { logout(); return; }
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch { logout(); return; }
  }

  const user = getUser();
  document.querySelectorAll('.user-name').forEach(el => { if (user) el.textContent = user.name; });
  document.querySelectorAll('.auth-only').forEach(el => { el.style.display = isLoggedIn() ? '' : 'none'; });
  document.querySelectorAll('.guest-only').forEach(el => { el.style.display = isLoggedIn() ? 'none' : ''; });
  const pc = document.getElementById('headerPincode');
  if (pc) pc.textContent = user && user.primary_address?.pincode ? '📍 ' + user.primary_address.pincode : '';
  const pcMobile = document.getElementById('headerPincodeMobile');
  if (pcMobile) pcMobile.textContent = user && user.primary_address?.pincode ? '📍 ' + user.primary_address.pincode : '';

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = document.querySelector('.theme-toggle i');
  if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

  updateCartCount();
  initScrollAnimations();
  initNavbarScroll();
  addRippleEffect();
});
