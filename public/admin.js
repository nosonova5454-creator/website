

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof refreshSession === 'function') await refreshSession();
    if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
        alert('Доступ только для администраторов. Войдите под учётной записью admin.');
        window.location.href = 'auth.html';
        return;
    }

    const user = Auth.getUser();
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = `👑 ${user.first_name || user.login}`;

    // Инициализация вкладок 
    initTabs();
    
    // Загружаем справочники
    await loadDictionaries();
    
    // Настраиваем фильтры
    setupFilters();
    
    // Настраиваем формы
    setupForms();

    // Загружаем все данные
    await Promise.all([loadProducts(), loadOrders(), loadUsers(), loadReviews()]);
});

// Кнопка выхода
function logout() {
    Auth.logout();
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanels = document.querySelectorAll('.admin-tab-panel');
    
    console.log('Инициализация вкладок, найдено кнопок:', tabBtns.length);
    
    if (!tabBtns.length) {
        console.error('Кнопки вкладок не найдены!');
        return;
    }
    

    tabBtns.forEach(btn => {
      
        const handler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabId = this.getAttribute('data-tab');
            if (!tabId) {
                console.error('Нет data-tab атрибута у кнопки');
                return;
            }
            
            console.log('Переключение на вкладку:', tabId);
            
        
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
      
            tabPanels.forEach(panel => panel.classList.remove('active'));
            const targetPanel = document.getElementById(`tab-${tabId}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            } else {
                console.error('Панель не найдена: tab-' + tabId);
            }
        };
        
        btn.addEventListener('click', handler);
    });
}


// Справочники (жанры, издательства, типы обложек)

let GENRES = [], PUBLISHERS = [], COVER_TYPES = [];

async function loadDictionaries() {
    try {
        [GENRES, PUBLISHERS, COVER_TYPES] = await Promise.all([
            Dicts.genres(),
            Dicts.publishers(),
            Dicts.coverTypes(),
        ]);

   
        fillSelect('prodGenre',     GENRES,      'name');
        fillSelect('prodPublisher', PUBLISHERS,  'name');
        fillSelect('prodCoverType', COVER_TYPES, 'name');


        const catFilter = document.getElementById('categoryFilter');
        if (catFilter) {
            catFilter.innerHTML = '<option value="">Все жанры</option>' +
                GENRES.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
        }
    } catch (err) {
        console.error('Не удалось загрузить справочники:', err.message);
    }
}

function fillSelect(elId, items, labelKey) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '<option value="">— не выбрано —</option>' +
        items.map(item => `<option value="${item.id}">${escapeHtml(item[labelKey])}</option>`).join('');
}


// Фильтр

function setupFilters() {
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', fn);
    };
    const bindC = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', fn);
    };
    bind('productSearch', loadProducts);
    bindC('categoryFilter', loadProducts);
    bindC('orderStatusFilter', loadOrders);
    bind('orderSearch', loadOrders);
    bind('userSearch', loadUsers);
    bindC('reviewStatusFilter', loadReviews);
}

function setupForms() {
    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', saveProduct);
    
    const orderForm = document.getElementById('orderForm');
    if (orderForm) orderForm.addEventListener('submit', saveOrder);
    
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', saveUser);
}

// товарыы

async function loadProducts() {
    const search   = document.getElementById('productSearch')?.value || '';
    const genre_id = document.getElementById('categoryFilter')?.value || '';
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Загрузка...</td></tr>';

    try {
        const params = { admin: '1', limit: 500 };
        if (search)   params.search   = search;
        if (genre_id) params.genre_id = genre_id;

        const { books } = await Books.getAll(params);
        if (!books || !books.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Книги не найдены</td></tr>';
            return;
        }
        tbody.innerHTML = books.map(b => `
            <tr>
                <td>${b.id}</td>
                <td><img src="${b.cover_url || ''}" style="width:40px;height:60px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'"></td>
                <td><strong>${escapeHtml(b.title)}</strong>${b.is_active === false ? ' <small style="color:#999">(скрыта)</small>' : ''}</td>
                <td>${escapeHtml(b.author)}</td>
                <td>${b.price} ₽${b.old_price ? `<br><small style="text-decoration:line-through;color:#aaa">${b.old_price} ₽</small>` : ''}</td>
                <td>${escapeHtml(b.genre || '—')}</td>
                <td>
                    <button class="btn-icon" onclick="editProduct(${b.id})">✏️</button>
                    <button class="btn-icon delete" onclick="deleteProduct(${b.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red)">${err.message}</td></tr>`;
    }
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;

    const data = {
        title:               document.getElementById('prodTitle').value,
        author:              document.getElementById('prodAuthor').value,
        price:               parseFloat(document.getElementById('prodPrice').value),
        old_price:           parseFloat(document.getElementById('prodOldPrice').value) || null,
        genre_id:            parseInt(document.getElementById('prodGenre').value)       || null,
        publisher_id:        parseInt(document.getElementById('prodPublisher').value)   || null,
        cover_type_id:       parseInt(document.getElementById('prodCoverType').value)   || null,
        year_published:      parseInt(document.getElementById('prodYear').value)        || null,
        pages:               parseInt(document.getElementById('prodPages').value)       || null,
        weight_g:            parseInt(document.getElementById('prodWeight').value)      || null,
        dimensions:          document.getElementById('prodDimensions').value,
        stock:               parseInt(document.getElementById('prodStock').value)       || 0,
        isbn:                document.getElementById('prodIsbn').value,
        cover_url:           document.getElementById('prodCover').value,
        description:         document.getElementById('prodDescription').value,
        tag_new:             document.getElementById('prodTagNew').checked,
        tag_popular:         document.getElementById('prodTagPopular').checked,
    };

    try {
        if (id) {
            await Books.update(id, data);
            showNotice('Книга обновлена', 'success');
        } else {
            await Books.create(data);
            showNotice('Книга добавлена', 'success');
        }
        closeProductModal();
        loadProducts();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Удалить эту книгу?')) return;
    try {
        await Books.delete(id);
        showNotice('Книга удалена');
        loadProducts();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}


// Заказы

const STATUS_LABELS = {
    processing: '⏳ Обрабатывается',
    confirmed:  '✅ Подтверждён',
    shipping:   '🚚 В доставке',
    delivered:  '📦 Доставлен',
    cancelled:  '❌ Отменён',
};

async function loadOrders() {
    const status = document.getElementById('orderStatusFilter')?.value || '';
    const search = document.getElementById('orderSearch')?.value || '';
    const tbody  = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Загрузка...</td></tr>';

    try {
        const params = {};
        if (status) params.status = status;
        if (search) params.search = search;
        const orders = await Orders.getAll(params);

        if (!orders || !orders.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Заказов нет</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><strong>#${o.id}</strong></td>
                <td>${new Date(o.created_at).toLocaleDateString('ru')}</td>
                <td>
                    ${escapeHtml(o.user_first_name || '')} ${escapeHtml(o.user_last_name || '')}<br>
                    <small style="color:var(--gray)">${escapeHtml(o.user_email || '')}</small>
                </td>
                <td style="max-width:220px;font-size:0.85rem">${escapeHtml(o.delivery_address || '—')}</td>
                <td><strong>${o.total_amount} ₽</strong></td>
                <td><span class="status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
                <td><button class="btn-icon" onclick='openOrderModal(${o.id}, "${o.status}", "${escapeHtml(o.delivery_note||'').replace(/'/g, "\\'")}", "${escapeHtml(o.tracking_number||'').replace(/'/g, "\\'")}")'>✏️</button></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red)">${err.message}</td></tr>`;
    }
}

async function saveOrder(e) {
    e.preventDefault();
    const id = document.getElementById('orderId').value;
    try {
        await Orders.updateStatus(id, {
            status:          document.getElementById('orderStatus').value,
            delivery_note:   document.getElementById('deliveryInfo').value,
            tracking_number: document.getElementById('trackingNumber').value,
        });
        showNotice('Заказ обновлён', 'success');
        closeOrderModal();
        loadOrders();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}

// Пользователь

async function loadUsers() {
    const search = document.getElementById('userSearch')?.value || '';
    const tbody  = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Загрузка...</td></tr>';

    try {
        const users = await Users.getAll(search ? { search } : {});
        if (!users || !users.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Пользователи не найдены</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id ? u.id.substring(0,8) : '...'}…</td>
                <td><strong>${escapeHtml(u.first_name || '')} ${escapeHtml(u.last_name || '')}</strong><br><small>${escapeHtml(u.login)}</small></td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="role-badge role-${u.role}">${u.role === 'admin' ? '👑 Админ' : '👤 Пользователь'}</span></td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('ru') : ''}</td>
                <td>${u.order_count || 0}</td>
                <td>
                    <button class="btn-icon" onclick='editUser("${u.id}", "${escapeHtml(u.first_name||'').replace(/'/g, "\\'")}", "${escapeHtml(u.last_name||'').replace(/'/g, "\\'")}", "${escapeHtml(u.email)}", "${u.role}")'>✏️</button>
                    ${u.role !== 'admin' ? `<button class="btn-icon delete" onclick="deleteUser('${u.id}')">🗑️</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red)">${err.message}</td></tr>`;
    }
}

async function saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    try {
        await Users.update(id, {
            first_name: document.getElementById('editUserName').value,
            last_name: document.getElementById('editUserLastName').value,
            email:      document.getElementById('editUserEmail').value,
            role:       document.getElementById('editUserRole').value,
            password:   document.getElementById('editUserPassword').value || undefined,
        });
        showNotice('Пользователь обновлён', 'success');
        closeUserModal();
        loadUsers();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Деактивировать пользователя?')) return;
    try {
        await Users.delete(id);
        showNotice('Пользователь деактивирован');
        loadUsers();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}


// Отзыв

async function loadReviews() {
    const status = document.getElementById('reviewStatusFilter')?.value || '';
    const tbody  = document.getElementById('reviewsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Загрузка...</td></tr>';

    try {
        const reviews = await Reviews.getAll(status ? { status } : {});
        if (!reviews || !reviews.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa">Отзывов нет</td></tr>';
            return;
        }
        tbody.innerHTML = reviews.map(r => {
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
            const statusMap = { pending: '⏳ На модерации', approved: '✅ Одобрен', hidden: '🚫 Скрыт' };
            return `
                <tr>
                    <td><strong>${escapeHtml(r.book_title)}</strong></td>
                    <td>${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}</td>
                    <td style="color:#ffb400">${stars}</td>
                    <td style="max-width:280px;font-size:0.88rem">${escapeHtml(r.text || '—')}</td>
                    <td>${new Date(r.created_at).toLocaleDateString('ru')}</td>
                    <td>${statusMap[r.status] || r.status}</td>
                    <td>
                        ${r.status !== 'approved' ? `<button class="btn-icon" onclick="moderateReview(${r.id},'approved')" title="Одобрить">✓</button>` : ''}
                        ${r.status === 'approved' ? `<button class="btn-icon" onclick="moderateReview(${r.id},'hidden')" title="Скрыть">🚫</button>` : ''}
                        <button class="btn-icon delete" onclick="deleteReview(${r.id})" title="Удалить">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red)">${err.message}</td></tr>`;
    }
}

async function moderateReview(id, status) {
    try {
        await Reviews.moderate(id, status);
        showNotice(status === 'approved' ? 'Отзыв одобрен' : 'Отзыв скрыт', 'success');
        loadReviews();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}

async function deleteReview(id) {
    if (!confirm('Удалить отзыв?')) return;
    try {
        await Reviews.delete(id);
        showNotice('Отзыв удалён');
        loadReviews();
    } catch (err) {
        showNotice(err.message, 'error');
    }
}


// окна редактирования админ

function openProductModal(id) {
    const form = document.getElementById('productForm');
    if (form) form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').textContent = 'Добавить книгу';

    if (id) {
        Books.getById(id).then(book => {
            document.getElementById('modalTitle').textContent = 'Редактировать книгу';
            document.getElementById('productId').value       = book.id;
            document.getElementById('prodTitle').value       = book.title       || '';
            document.getElementById('prodAuthor').value      = book.author      || '';
            document.getElementById('prodPrice').value       = book.price       ?? '';
            document.getElementById('prodOldPrice').value    = book.old_price   ?? '';
            document.getElementById('prodGenre').value       = book.genre_id != null ? String(book.genre_id) : '';
            document.getElementById('prodPublisher').value   = book.publisher_id != null ? String(book.publisher_id) : '';
            document.getElementById('prodCoverType').value   = book.cover_type_id != null ? String(book.cover_type_id) : '';
            document.getElementById('prodYear').value        = book.year_published ?? '';
            document.getElementById('prodPages').value       = book.pages       ?? '';
            document.getElementById('prodWeight').value      = book.weight_g    ?? '';
            document.getElementById('prodDimensions').value  = book.dimensions  || '';
            document.getElementById('prodStock').value       = book.stock       ?? 0;
            document.getElementById('prodIsbn').value        = book.isbn        || '';
            document.getElementById('prodCover').value       = book.cover_url   || '';
            document.getElementById('prodDescription').value = book.description || '';
            document.getElementById('prodTagNew').checked     = !!book.tag_new;
            document.getElementById('prodTagPopular').checked = !!book.tag_popular;
        }).catch(err => showNotice(err.message, 'error'));
    }
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('open');
}

function closeProductModal() { 
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('open');
}

function editProduct(id) { openProductModal(id); }

function openOrderModal(id, status, deliveryNote, trackingNum) {
    document.getElementById('orderId').value        = id;
    document.getElementById('orderStatus').value    = status;
    document.getElementById('deliveryInfo').value   = deliveryNote || '';
    document.getElementById('trackingNumber').value = trackingNum  || '';
    const modal = document.getElementById('orderModal');
    if (modal) modal.classList.add('open');
}

function closeOrderModal() { 
    const modal = document.getElementById('orderModal');
    if (modal) modal.classList.remove('open');
}

function editUser(id, firstName, lastName, email, role) {
    document.getElementById('editUserId').value       = id;
    document.getElementById('editUserName').value     = firstName;
    document.getElementById('editUserLastName').value = lastName;
    document.getElementById('editUserEmail').value    = email;
    document.getElementById('editUserRole').value     = role;
    document.getElementById('editUserPassword').value = '';
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.add('open');
}

function closeUserModal() { 
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.remove('open');
}

document.addEventListener('click', e => {
    if (e.target.classList && e.target.classList.contains('modal')) {
        e.target.classList.remove('open');
    }
});



function showNotice(msg, type = 'info') {
    let notice = document.getElementById('adminNotice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'adminNotice';
        notice.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:9999;
            padding:14px 22px; border-radius:10px; font-size:0.92rem;
            font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,0.15);
            transition:opacity 0.3s; max-width:340px;
        `;
        document.body.appendChild(notice);
    }
    const colors = { success: '#00aa44', error: '#d32f2f', info: '#0055cc' };
    notice.style.background = colors[type] || colors.info;
    notice.style.color = '#fff';
    notice.style.opacity = '1';
    notice.textContent = msg;
    clearTimeout(notice._timeout);
    notice._timeout = setTimeout(() => { notice.style.opacity = '0'; }, 3000);
}


function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]
    );
}