(function () {
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function formatRub(n) {
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }

    async function render() {
        const root = document.getElementById('cart-items-root');
        const layout = document.querySelector('.cart-layout');
        const header = document.querySelector('.cart-header');
        const summary = document.querySelector('.cart-summary');
        const titleCount = document.getElementById('cart-title-count');
        const sumRow = document.getElementById('cart-summary-items');
        const totalRow = document.getElementById('cart-total-pay');

        if (!root) return;

        if (!Auth.isLoggedIn()) {
            if (layout) layout.classList.add('auth-only');
            if (header) header.style.display = 'none';
            if (summary) summary.style.display = 'none';
            root.innerHTML = `
                <div class="auth-required-message">
                    <p>Войдите, чтобы увидеть заказы</p>
                    <a href="auth.html" class="btn-go">Войти</a>
                </div>`;
            if (titleCount) titleCount.textContent = '';
            if (sumRow) sumRow.innerHTML = '';
            if (totalRow) totalRow.textContent = '—';
            return;
        }

        if (layout) layout.classList.remove('auth-only');
        if (header) header.style.display = '';
        if (summary) summary.style.display = '';

        root.innerHTML = '<p style="color:#aaa">Загрузка…</p>';
        let rows;
        try {
            rows = await Cart.get();
        } catch (e) {
            root.innerHTML = `<p style="color:#c62828">${esc(e.message)}</p>`;
            return;
        }

        if (!rows.length) {
            root.innerHTML = '<p style="color:#aaa;text-align:center;padding:32px">Корзина пуста. <a href="homepage.html">В каталог</a></p>';
            if (titleCount) titleCount.textContent = '0 товаров';
            if (sumRow) sumRow.innerHTML = '<span>Товары</span><span>0 ₽</span>';
            if (totalRow) totalRow.textContent = '0 ₽';
            return;
        }

        let qtySum = 0;
        let sum = 0;
        root.innerHTML = rows.map(line => {
            const q = Number(line.quantity) || 0;
            const price = Number(line.price) || 0;
            qtySum += q;
            sum += price * q;
            const bid = line.book_id;
            return `
<div class="cart-item" data-book-id="${bid}">
    <img class="cart-item-img" src="${esc(line.cover_url)}" alt="">
    <div class="cart-item-info">
        <a href="product_card.html?id=${bid}" class="cart-item-title">${esc(line.title)}</a>
        <div class="cart-item-author">${esc(line.author)}</div>
        <div class="qty-control">
            <button type="button" class="qty-btn" data-act="-1">−</button>
            <input class="qty-value" type="text" value="${q}" readonly>
            <button type="button" class="qty-btn" data-act="1">+</button>
        </div>
    </div>
    <div class="cart-item-price">
        <span class="price">${formatRub(price * q)}</span>
        <button type="button" class="cart-remove" title="Удалить">✕</button>
    </div>
</div>`;
        }).join('');

        if (titleCount) titleCount.textContent = `${qtySum} ${pluralRu(qtySum, 'товар', 'товара', 'товаров')}`;
        if (sumRow) sumRow.innerHTML = `<span>Товары (${qtySum} шт.)</span><span>${formatRub(sum)}</span>`;
        if (totalRow) totalRow.textContent = formatRub(sum);

        root.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.cart-item');
                const bookId = +item.dataset.bookId;
                const input = item.querySelector('.qty-value');
                let v = parseInt(input.value, 10) || 1;
                const d = btn.dataset.act === '1' ? 1 : -1;
                v += d;
                if (v < 1) v = 1;
                try {
                    await Cart.update(bookId, v);
                    await render();
                } catch (e) {
                    alert(e.message);
                }
            });
        });

        root.querySelectorAll('.cart-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.cart-item');
                const bookId = +item.dataset.bookId;
                try {
                    await Cart.remove(bookId);
                    await render();
                } catch (e) {
                    alert(e.message);
                }
            });
        });
    }

    function pluralRu(n, one, few, many) {
        const m = n % 100;
        const d = n % 10;
        if (m >= 11 && m <= 19) return many;
        if (d === 1) return one;
        if (d >= 2 && d <= 4) return few;
        return many;
    }

    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.addEventListener('click', async () => {
            if (!Auth.isLoggedIn()) {
                window.location.href = 'auth.html';
                return;
            }
            let rows;
            try {
                rows = await Cart.get();
            } catch (e) {
                alert(e.message);
                return;
            }
            if (!rows.length) {
                alert('Корзина пуста');
                return;
            }
            const addr = window.prompt('Адрес доставки:', '') || '';
            const items = rows.map(r => ({ book_id: r.book_id, quantity: Number(r.quantity) || 1 }));
            try {
                await Orders.create({ items, delivery_address: addr });
                alert('Заказ оформлен!');
                window.location.href = 'orders.html';
            } catch (e) {
                alert(e.message || 'Не удалось оформить');
            }
        });
    }

    const btnClear = document.querySelector('.cart-clear');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            if (!Auth.isLoggedIn()) return;
            let rows;
            try {
                rows = await Cart.get();
            } catch {
                return;
            }
            for (const r of rows) {
                try {
                    await Cart.remove(r.book_id);
                } catch { /* ignore */ }
            }
            await render();
        });
    }

    document.addEventListener('DOMContentLoaded', render);
})();
