(function () {
    const params = new URLSearchParams(location.search);
    const rawId = params.get('id');
    let BOOK_ID = rawId ? parseInt(rawId, 10) : NaN;

    function escHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function formatRub(n) {
        if (n == null || n === '') return '—';
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }

    function row(label, val) {
        if (val === null || val === undefined || val === '') return '';
        return `<tr><td>${escHtml(label)}</td><td>${escHtml(String(val))}</td></tr>`;
    }

    async function loadProduct() {
        const errEl = document.getElementById('pc-error');
        const layout = document.getElementById('product-layout');
        const ratingWrap = document.getElementById('pc-rating-wrap');

        if (Number.isNaN(BOOK_ID)) {
            errEl.textContent = 'Откройте книгу по ссылке с главной (product_card.html?id=номер).';
            errEl.style.display = 'block';
            layout.style.display = 'none';
            ratingWrap.style.display = 'none';
            return null;
        }

        let book;
        try {
            book = await Books.getById(BOOK_ID);
        } catch (e) {
            errEl.textContent = e.message || 'Книга не найдена';
            errEl.style.display = 'block';
            layout.style.display = 'none';
            ratingWrap.style.display = 'none';
            return null;
        }

        document.title = `${book.title} — ЧитайСтрана`;
        document.getElementById('pc-crumb').textContent = book.title;
        document.getElementById('pc-cover').src = book.cover_url || '';
        document.getElementById('pc-cover').alt = book.title || '';
        document.getElementById('pc-title').textContent = book.title || '';
        document.getElementById('pc-author').textContent = book.author || '';
        document.getElementById('pc-desc').textContent = book.description || '';

        const avg = book.avg_rating != null ? Number(book.avg_rating) : 0;
        document.getElementById('pc-stars').textContent = '★'.repeat(Math.min(5, Math.round(avg) || 1));
        document.getElementById('pc-rating-num').textContent = avg ? avg.toFixed(1) : '—';
        const rc = book.review_count != null ? Number(book.review_count) : 0;
        document.getElementById('pc-rating-votes').textContent = rc ? `(${rc} оценок)` : '';

        const tbody = document.getElementById('pc-specs');
        tbody.innerHTML = [
            row('Жанр', book.genre),
            row('Тип обложки', book.cover_type),
            row('Количество страниц', book.pages),
            row('Вес, г', book.weight_g),
            row('Размер', book.dimensions),
            row('Издательство', book.publisher),
            row('Тип литературы', book.literature_type),
            row('ISBN', book.isbn),
            row('Год издания', book.year_published),
        ].filter(Boolean).join('');

        const oldP = document.getElementById('pc-price-old');
        const newP = document.getElementById('pc-price-new');
        if (book.old_price) {
            oldP.style.display = 'block';
            oldP.textContent = formatRub(book.old_price);
        } else {
            oldP.style.display = 'none';
        }
        newP.textContent = formatRub(book.price);

        const stock = book.stock != null ? Number(book.stock) : 0;
        document.getElementById('pc-stock').textContent =
            stock > 0 ? ` В наличии (${stock} шт.)` : ' Нет в наличии';

        async function addToCart() {
            if (!Auth.isLoggedIn()) {
                window.location.href = 'auth.html';
                return;
            }
            try {
                await Cart.add(BOOK_ID, 1);
                alert('Книга добавлена в корзину');
            } catch (e) {
                alert(e.message || 'Ошибка');
            }
        }

        document.getElementById('pc-buy').onclick = addToCart;
        document.getElementById('pc-add-cart').onclick = addToCart;

        document.getElementById('pc-fav').onclick = async () => {
            if (!Auth.isLoggedIn()) {
                window.location.href = 'auth.html';
                return;
            }
            try {
                await Favorites.add(BOOK_ID);
                alert('Добавлено в избранное');
            } catch (e) {
                alert(e.message || 'Ошибка');
            }
        };

        if (Auth.isLoggedIn()) {
            History.add(BOOK_ID).catch(() => {});
        }

        return book;
    }

    async function loadReviews() {
        const list = document.getElementById('reviewsList');
        if (Number.isNaN(BOOK_ID)) return;
        try {
            const reviews = await Reviews.getByBook(BOOK_ID);
            if (!reviews.length) {
                list.innerHTML = '<div style="color:#aaa;text-align:center;padding:32px 0">Отзывов пока нет. Будьте первым!</div>';
                return;
            }
            list.innerHTML = reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-author">${escHtml(r.first_name || r.login || 'Пользователь')}</span>
                    <span class="review-stars" style="color:#ffb400">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    <span class="review-date">${new Date(r.created_at).toLocaleDateString('ru')}</span>
                </div>
                <div class="review-text">${escHtml(r.text || '')}</div>
            </div>
        `).join('');
        } catch {
            list.innerHTML = '<div style="color:#aaa;text-align:center;padding:32px 0">Не удалось загрузить отзывы</div>';
        }
    }

    let selectedRating = 0;
    function highlightStars(n) {
        document.querySelectorAll('.star').forEach(s => {
            s.style.color = +s.dataset.v <= n ? '#ffb400' : '#ccc';
        });
    }

    window.submitReview = async function () {
        if (Number.isNaN(BOOK_ID)) return;
        if (!Auth.isLoggedIn()) {
            window.location.href = 'auth.html';
            return;
        }
        const rating = +document.getElementById('ratingValue').value;
        const text = document.getElementById('reviewText').value.trim();
        const msgEl = document.getElementById('reviewMsg');

        if (!rating) {
            msgEl.style.color = 'var(--red)';
            msgEl.textContent = 'Выберите оценку';
            return;
        }

        try {
            await Reviews.create(BOOK_ID, rating, text);
            msgEl.style.color = 'var(--green)';
            msgEl.textContent = 'Отзыв отправлен на модерацию!';
            document.getElementById('reviewText').value = '';
            selectedRating = 0;
            highlightStars(0);
            loadReviews();
        } catch (err) {
            msgEl.style.color = 'var(--red)';
            msgEl.textContent = err.message;
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        await loadProduct();
        await loadReviews();

        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('mouseenter', () => highlightStars(+star.dataset.v));
            star.addEventListener('mouseleave', () => highlightStars(selectedRating));
            star.addEventListener('click', () => {
                selectedRating = +star.dataset.v;
                document.getElementById('ratingValue').value = selectedRating;
                highlightStars(selectedRating);
            });
        });
        highlightStars(0);
    });
})();
