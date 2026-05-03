// Новинки» и Популярное
(function () {
    const favoriteIds = new Set();

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function formatRub(n) {
        if (n == null || n === '') return '—';
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }

    function cardHtml(b) {
        const tag = b.tag_new
            ? '<span class="tag-new">Новинка</span>'
            : b.tag_popular
                ? '<span class="tag-popular">Популярное</span>'
                : '';
        const rc = b.review_count ? ` · ${b.review_count}` : '';
        const isFav = favoriteIds.has(Number(b.id));
        return `
<a href="product_card.html?id=${b.id}" class="book-card">
    <div class="book-cover">
        ${tag}
        <button type="button" class="favorite-btn${isFav ? ' active' : ''}" onclick="window.addFavFromHome(event, ${b.id})" aria-label="В избранное"><span class="heart">${isFav ? '♥' : '♡'}</span></button>
        <img src="${esc(b.cover_url)}" alt="${esc(b.title)}">
    </div>
    <div class="book-info">
        <div class="book-title">${esc(b.title)}</div>
        <div class="book-author">${esc(b.author)}</div>
        <div class="price-block"><span class="price">${formatRub(b.price)}</span></div>
        <div class="rating">★★★★★${rc}</div>
        <div class="btn-buy">Купить</div>
    </div>
</a>`;
    }

    window.addFavFromHome = async function (e, bookId) {
        e.preventDefault();
        e.stopPropagation();
        if (!Auth.isLoggedIn()) {
            window.location.href = 'auth.html';
            return;
        }
        const btn = e.currentTarget;
        const heart = btn?.querySelector('.heart');
        const numericId = Number(bookId);
        try {
            if (favoriteIds.has(numericId)) {
                await Favorites.remove(numericId);
                favoriteIds.delete(numericId);
                if (btn) btn.classList.remove('active');
                if (heart) heart.textContent = '♡';
            } else {
                await Favorites.add(numericId);
                favoriteIds.add(numericId);
                if (btn) btn.classList.add('active');
                if (heart) heart.textContent = '♥';
            }
        } catch (err) {
            alert(err.message || 'Не удалось обновить избранное');
        }
    };

    async function loadFavoriteIds() {
        if (!Auth.isLoggedIn()) return;
        try {
            const rows = await Favorites.get();
            favoriteIds.clear();
            rows.forEach(row => favoriteIds.add(Number(row.book_id)));
        } catch (_err) {
            
        }
    }

    async function fillGrid(elId, params) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa">Загрузка…</p>';
        try {
            const { books } = await Books.getAll(params);
            if (!books || !books.length) {
                el.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa">Пока нет книг в этой подборке</p>';
                return;
            }
            el.innerHTML = books.map(cardHtml).join('');
        } catch (err) {
            el.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#c62828">${esc(err.message)}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await loadFavoriteIds();
        fillGrid('books-grid-new', { tag: 'new', limit: 12, sort: 'new' });
        fillGrid('books-grid-popular', { tag: 'popular', limit: 12, sort: 'rating' });
    });
})();
