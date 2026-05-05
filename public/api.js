

const API_BASE = '/api';




async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(API_BASE + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}`);
    }
    return data;
}




const Auth = {
    async login(login, password) {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ login, password })
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
    },

    async register(login, email, password, first_name, last_name, phone) {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ login, email, password, first_name, last_name, phone })
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'homepage.html';
    },

    getUser() {
        try { 
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        } catch { 
            return null; 
        }
    },

    isLoggedIn() { 
        return !!localStorage.getItem('token'); 
    },
    
    isAdmin() { 
        return this.getUser()?.role === 'admin'; 
    }
};




const Books = {
    getAll: (params = {}) => {
        const queryParams = new URLSearchParams(params);
        return apiFetch('/books?' + queryParams.toString());
    },
    getById: (id) => apiFetch(`/books/${id}`),
    create: (data) => apiFetch('/books', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/books/${id}`, { method: 'DELETE' }),
};






const Orders = {
    getAll: (params = {}) => {
        const queryParams = new URLSearchParams(params);
        return apiFetch('/orders?' + queryParams.toString());
    },
    getItems: (orderId) => apiFetch(`/orders/${orderId}/items`),
    create: (data) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, data) => apiFetch(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};




const Cart = {
    get: () => apiFetch('/cart'),
    add: (book_id, quantity = 1) => apiFetch('/cart', { 
        method: 'POST', 
        body: JSON.stringify({ book_id, quantity }) 
    }),
    update: (book_id, quantity) => apiFetch(`/cart/${book_id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ quantity }) 
    }),
    remove: (book_id) => apiFetch(`/cart/${book_id}`, { method: 'DELETE' }),
};




const Favorites = {
    get: () => apiFetch('/favorites'),
    add: (book_id) => apiFetch('/favorites', { 
        method: 'POST', 
        body: JSON.stringify({ book_id }) 
    }),
    remove: (book_id) => apiFetch(`/favorites/${book_id}`, { method: 'DELETE' }),
};


// Отзывы

const Reviews = {
    getByBook: (book_id) => apiFetch(`/reviews?book_id=${book_id}`),
    getAll: (params = {}) => {
        const queryParams = new URLSearchParams(params);
        return apiFetch('/reviews/all?' + queryParams.toString());
    },
    create: (book_id, rating, text) => apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ book_id, rating, text })
    }),
    moderate: (id, status) => apiFetch(`/reviews/${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ status }) 
    }),
    delete: (id) => apiFetch(`/reviews/${id}`, { method: 'DELETE' }),
};




const Users = {
    getAll: (params = {}) => {
        const queryParams = new URLSearchParams(params);
        return apiFetch('/users?' + queryParams.toString());
    },
    update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
};


// Справочники

const Dicts = {
    genres: () => apiFetch('/genres'),
    publishers: () => apiFetch('/publishers'),
    coverTypes: () => apiFetch('/cover-types'),
};

const Tags = {
    getAll: () => apiFetch('/tags'),
};


const Promo = {
    check: (code) => apiFetch('/promo/check', { 
        method: 'POST', 
        body: JSON.stringify({ code }) 
    }),
    getAll: () => apiFetch('/promo'),
};


const History = {
    get: () => apiFetch('/history'),
    add: (book_id) => apiFetch('/history', { 
        method: 'POST', 
        body: JSON.stringify({ book_id }) 
    }),
};


async function refreshSession() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const user = await apiFetch('/auth/me');
        localStorage.setItem('user', JSON.stringify(user));
    } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}


function initHeader() {
    const user = Auth.getUser();
    const iconsEl = document.querySelector('.header-icons');
    if (!iconsEl) return;

    if (user) {
        const name = (user.first_name || user.login || '').trim() || 'Профиль';
        iconsEl.innerHTML = `
            <span class="header-user-badge" title="${user.role === 'admin' ? 'Администратор' : 'Вы вошли'}">
                ${user.role === 'admin' ? '👑' : '👤'} <strong>${escapeHtml(name)}</strong>
            </span>
            ${user.role === 'admin' ? '<a href="admin.html">Админка</a>' : ''}
            <a href="orders.html">Заказы</a>
            <a href="mybooks.html">Мои книги</a>
            <a href="cart.html">Корзина</a>
            <a href="#" class="header-logout" onclick="Auth.logout(); return false">Выйти</a>
        `;
    } else {
        iconsEl.innerHTML = `
            <a href="auth.html" class="header-login-btn">Войти</a>
            <a href="orders.html">Заказы</a>
            <a href="mybooks.html">Мои книги</a>
            <a href="cart.html">Корзина</a>
        `;
    }
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
    });
}



window.apiFetch = apiFetch;
window.Auth = Auth;
window.Books = Books;
window.Orders = Orders;
window.Cart = Cart;
window.Favorites = Favorites;
window.Reviews = Reviews;
window.Users = Users;
window.Dicts = Dicts;
window.Tags = Tags;
window.Promo = Promo;
window.History = History;
window.refreshSession = refreshSession;
window.initHeader = initHeader;


if (!window.skipAutoInit) {
    document.addEventListener('DOMContentLoaded', async () => {
        await refreshSession();
        initHeader();
    });
}