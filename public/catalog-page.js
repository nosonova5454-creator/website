(function () {
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }
    function formatRub(n) {
        if (n == null || n === '') return '—';
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }
    function cardHtml(b) {
        const tag = b.tag_new ? '<span class="tag-new">Новинка</span>' : (b.tag_popular ? '<span class="tag-popular">Популярное</span>' : '');
        return `<a href="product_card.html?id=${b.id}" class="book-card">
    <div class="book-cover">${tag}<img src="${esc(b.cover_url)}" alt="${esc(b.title)}"></div>
    <div class="book-info">
        <div class="book-title">${esc(b.title)}</div>
        <div class="book-author">${esc(b.author)}</div>
        <div class="price-block"><span class="price">${formatRub(b.price)}</span></div>
        <div class="btn-buy">Купить</div>
    </div>
</a>`;
    }

    async function render() {
        const p = new URLSearchParams(location.search);
        const genreId = Number(p.get('genre_id'));

        let categories = [];
        try {
            categories = await Dicts.genres();
        } catch (e) {
            const gridEl = document.getElementById('catalog-grid');
            if (gridEl) gridEl.innerHTML = `<p style="grid-column:1/-1;color:#c62828">${esc(e.message || 'Не удалось загрузить категории')}</p>`;
            return;
        }

        const cat = categories.find(x => Number(x.id) === genreId);

        const catsEl = document.getElementById('catalog-cats');
        catsEl.innerHTML = categories.map(c =>
            `<a href="catalog.html?genre_id=${c.id}" style="padding:8px 10px;border-radius:8px;text-decoration:none;color:${Number(c.id) === genreId ? '#fff' : '#222'};background:${Number(c.id) === genreId ? 'var(--primary)' : '#f6f7f8'}">${esc(c.name)}</a>`
        ).join('');

        const titleEl = document.getElementById('catalog-title');
        const metaEl = document.getElementById('catalog-meta');
        const gridEl = document.getElementById('catalog-grid');

        if (!genreId || !cat) {
            titleEl.textContent = 'Каталог книг';
            metaEl.textContent = 'Выберите категорию слева';
            gridEl.innerHTML = '<p style="grid-column:1/-1;color:#888">Выберите категорию, чтобы увидеть книги.</p>';
            return;
        }

        titleEl.textContent = cat.name;
        gridEl.innerHTML = '<p style="grid-column:1/-1;color:#aaa">Загрузка…</p>';
        try {
            const { books, total } = await Books.getAll({ genre_id: genreId, limit: 200, sort: 'new' });
            const filtered = (Array.isArray(books) ? books : []).filter(b =>
                Number(b.genre_id) === genreId || String(b.genre || '').trim() === String(cat.name || '').trim()
            );
            metaEl.textContent = `Найдено книг: ${filtered.length || Number(total) || 0}`;
            if (!filtered.length) {
                gridEl.innerHTML = '<p style="grid-column:1/-1;color:#888">В этой категории пока нет книг.</p>';
                return;
            }
            gridEl.innerHTML = filtered.map(cardHtml).join('');
        } catch (e) {
            gridEl.innerHTML = `<p style="grid-column:1/-1;color:#c62828">${esc(e.message)}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', render);
})();
