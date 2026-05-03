(function () {
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function formatRub(n) {
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }

    async function render() {
        const grid = document.getElementById('wishlist-root');
        const tabCount = document.getElementById('wishlist-tab-count');
        if (!grid) return;

        if (!Auth.isLoggedIn()) {
            grid.innerHTML = '<p style="color:#666;text-align:center;padding:32px">Войдите, чтобы увидеть избранное</p>';
            if (tabCount) tabCount.textContent = '0';
            return;
        }

        grid.innerHTML = '<p style="color:#aaa;text-align:center">Загрузка…</p>';
        let rows;
        try {
            rows = await Favorites.get();
        } catch (e) {
            grid.innerHTML = `<p style="color:#c62828;text-align:center">${esc(e.message)}</p>`;
            return;
        }

        if (tabCount) tabCount.textContent = String(rows.length);

        if (!rows.length) {
            grid.innerHTML = '<p style="color:#aaa;text-align:center;padding:32px">В избранном пока пусто. <a href="homepage.html">В магазин</a></p>';
            return;
        }

        grid.innerHTML = rows.map(f => {
            const bid = f.book_id;
            return `
<div class="wishlist-card" data-book-id="${bid}">
    <a href="product_card.html?id=${bid}" class="book-card">
        <div class="book-cover">
            <button type="button" class="wishlist-remove" title="Удалить из избранного">✕</button>
            <img src="${esc(f.cover_url)}" alt="${esc(f.title)}">
        </div>
        <div class="book-info">
            <div class="book-title">${esc(f.title)}</div>
            <div class="book-author">${esc(f.author)}</div>
            <div class="price-block"><span class="price">${formatRub(f.price)}</span></div>
            <div class="rating">★★★★★</div>
            <div class="btn-buy">В корзину</div>
        </div>
    </a>
</div>`;
        }).join('');

        grid.querySelectorAll('.wishlist-remove').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.preventDefault();
                e.stopPropagation();
                const card = btn.closest('.wishlist-card');
                const bookId = +card.dataset.bookId;
                try {
                    await Favorites.remove(bookId);
                    await render();
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', render);
})();
