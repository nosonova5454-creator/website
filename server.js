

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;


// Подключение  PostgreSQL

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bookstore',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

pool.connect()
    .then(() => console.log(' PostgreSQL подключён'))
    .catch(err => console.error('Ошибка подключения к БД:', err));




app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.get('/', (_req, res) => res.redirect('/homepage.html'));
app.use(express.static('public'));

function verifyToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    } catch {
        return null;
    }
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Нет токена или токен недействителен' });
    req.user = payload;
    next();
}

function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== 'admin')
            return res.status(403).json({ error: 'Нет доступа' });
        next();
    });
}


// автррозаци я

app.post('/api/auth/register', async (req, res) => {
    try {
        const login = (req.body.login || '').trim();
        const email = (req.body.email || '').trim();
        const password = req.body.password || '';
        const { first_name, last_name, phone } = req.body;
        if (!login || !email || !password)
            return res.status(400).json({ error: 'Заполните обязательные поля' });

        const exists = await pool.query(
            'SELECT id FROM users WHERE login=$1 OR email=$2', [login, email]
        );
        if (exists.rows.length)
            return res.status(409).json({ error: 'Логин или email уже занят' });

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (login, email, password_hash, first_name, last_name, phone)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, login, email, first_name, role`,
            [login, email, hash, first_name || '', last_name || '', phone || '']
        );
        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, login: user.login, role: user.role },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '7d' }
        );
        res.json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const login = (req.body.login || '').trim();
        const password = req.body.password || '';
        if (!login || !password)
            return res.status(400).json({ error: 'Введите логин и пароль' });
        const result = await pool.query(
            'SELECT * FROM users WHERE (login=$1 OR email=$1) AND is_active=TRUE', [login]
        );
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash)))
            return res.status(401).json({ error: 'Неверный логин или пароль' });

        const token = jwt.sign(
            { id: user.id, login: user.login, role: user.role },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '7d' }
        );
        const { password_hash, ...safeUser } = user;
        res.json({ token, user: safeUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id,login,email,first_name,last_name,phone,role,created_at FROM users WHERE id=$1',
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// книги

app.get('/api/books', async (req, res) => {
    try {
        const { genre, genre_id, search, tag, sort, limit = 20, offset = 0, admin } = req.query;
        const token = req.headers.authorization?.split(' ')[1];
        const viewer = verifyToken(token);
        const listAllIncludingInactive = admin === '1' && viewer?.role === 'admin';

        let where = ['1=1'];
        if (!listAllIncludingInactive) where.push('b.is_active = TRUE');
        let params = [];
        let i = 1;

        if (genre_id) {
            where.push(`b.genre_id = $${i++}`);
            params.push(parseInt(genre_id, 10));
        } else if (genre) {
            where.push(`g.name = $${i++}`);
            params.push(genre);
        }
        if (search) {
            const terms = String(search).trim().split(/\s+/).filter(Boolean).slice(0, 8);
            if (terms.length) {
                for (const term of terms) {
                    where.push(`(b.title ILIKE $${i} OR b.author ILIKE $${i})`);
                    params.push(`%${term}%`);
                    i++;
                }
            }
        }
        if (tag === 'new') { where.push('b.tag_new = TRUE'); }
        if (tag === 'popular') { where.push('b.tag_popular = TRUE'); }

        const sortMap = {
            price_asc: 'b.price ASC',
            price_desc: 'b.price DESC',
            rating: 'avg_rating DESC',
            new: 'b.created_at DESC',
        };
        const orderBy = sortMap[sort] || 'b.created_at DESC';

        params.push(parseInt(limit), parseInt(offset));

        const sql = `
            SELECT
                b.id, b.title, b.author, b.genre_id, b.price, b.old_price,
                b.cover_url, b.tag_new, b.tag_popular, b.stock,
                g.name AS genre,
                COALESCE(ROUND(AVG(r.rating)::NUMERIC,1),0) AS avg_rating,
                COUNT(r.id) AS review_count
            FROM books b
            LEFT JOIN genres g ON b.genre_id = g.id
            LEFT JOIN reviews r ON b.id = r.book_id AND r.status='approved'
            WHERE ${where.join(' AND ')}
            GROUP BY b.id, g.name
            ORDER BY ${orderBy}
            LIMIT $${i++} OFFSET $${i++}
        `;
        const result = await pool.query(sql, params);

        const countSql = `
            SELECT COUNT(DISTINCT b.id)
            FROM books b
            LEFT JOIN genres g ON b.genre_id = g.id
            WHERE ${where.join(' AND ')}
        `;
        const count = await pool.query(countSql, params.slice(0, -2));

        res.json({ books: result.rows, total: parseInt(count.rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*,
                g.name AS genre,
                p.name AS publisher,
                ct.name AS cover_type,
                lt.name AS literature_type,
                (SELECT COALESCE(ROUND(AVG(rating)::NUMERIC,1),0)
                 FROM reviews WHERE book_id = b.id AND status = 'approved') AS avg_rating,
                (SELECT COUNT(*)::INT
                 FROM reviews WHERE book_id = b.id AND status = 'approved') AS review_count
             FROM books b
             LEFT JOIN genres g ON b.genre_id = g.id
             LEFT JOIN publishers p ON b.publisher_id = p.id
             LEFT JOIN cover_types ct ON b.cover_type_id = ct.id
             LEFT JOIN literature_types lt ON b.literature_type_id = lt.id
             WHERE b.id = $1`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Книга не найдена' });
        const book = result.rows[0];

        const token = req.headers.authorization?.split(' ')[1];
        const viewer = verifyToken(token);
        const isAdmin = viewer?.role === 'admin';
        if (!book.is_active && !isAdmin)
            return res.status(404).json({ error: 'Книга не найдена' });

        res.json(book);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/books', adminMiddleware, async (req, res) => {
    try {
        const {
            title, author, genre_id, publisher_id, cover_type_id, literature_type_id,
            year_published, pages, weight_g, dimensions,
            price, old_price, stock, isbn, cover_url, description, tag_new, tag_popular
        } = req.body;

        const result = await pool.query(
            `INSERT INTO books
             (title,author,genre_id,publisher_id,cover_type_id,literature_type_id,
              year_published,pages,weight_g,dimensions,
              price,old_price,stock,isbn,cover_url,description,tag_new,tag_popular)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [title, author, genre_id || null, publisher_id || null, cover_type_id || null, literature_type_id || null,
             year_published || null, pages || null, weight_g || null, dimensions || null,
             price, old_price || null, stock || 0, isbn || null, cover_url || null, description || null,
             tag_new || false, tag_popular || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/books/:id', adminMiddleware, async (req, res) => {
    try {
        const fields = ['title', 'author', 'genre_id', 'publisher_id', 'cover_type_id', 'literature_type_id',
            'year_published', 'pages', 'weight_g', 'dimensions',
            'price', 'old_price', 'stock', 'isbn', 'cover_url', 'description', 'tag_new', 'tag_popular', 'is_active'];
        const updates = [];
        const values = [];
        let i = 1;
        fields.forEach(f => {
            if (req.body[f] !== undefined) {
                updates.push(`${f}=$${i++}`);
                values.push(req.body[f]);
            }
        });
        if (!updates.length) return res.status(400).json({ error: 'Нет полей для обновления' });

        values.push(req.params.id);
        const result = await pool.query(
            `UPDATE books SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, values
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Книга не найдена' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/books/:id', adminMiddleware, async (req, res) => {
    try {
        await pool.query('UPDATE books SET is_active=FALSE WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// заказы

app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const { status, search } = req.query;
            let where = ['1=1'];
            let params = [];
            let i = 1;
            if (status) { where.push(`o.status=$${i++}`); params.push(status); }
            if (search) { where.push(`(CAST(o.id AS TEXT) ILIKE $${i} OR u.email ILIKE $${i++})`); params.push(`%${search}%`); }

            const result = await pool.query(`
                SELECT
                    o.*,
                    u.email AS user_email,
                    u.first_name AS user_first_name,
                    u.last_name AS user_last_name,
                    COALESCE((SELECT SUM(oi.quantity)::INT FROM order_items oi WHERE oi.order_id = o.id), 0) AS item_count,
                    COALESCE((SELECT json_agg(json_build_object('book_id', oi.book_id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url, 'quantity', oi.quantity, 'price', oi.price_at_order)) FROM order_items oi LEFT JOIN books b ON b.id = oi.book_id WHERE oi.order_id = o.id), '[]'::json) AS items
                FROM orders o
                JOIN users u ON o.user_id = u.id
                WHERE ${where.join(' AND ')}
                ORDER BY o.created_at DESC
            `, params);
            return res.json(result.rows);
        }

        const result = await pool.query(`
            SELECT 
                o.id, o.status, o.total_amount, o.delivery_address,
                o.tracking_number, o.delivery_note, o.created_at,
                COALESCE((SELECT SUM(oi.quantity)::INT FROM order_items oi WHERE oi.order_id = o.id), 0) AS item_count,
                COALESCE((SELECT json_agg(json_build_object('book_id', oi.book_id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url, 'quantity', oi.quantity, 'price', oi.price_at_order)) FROM order_items oi LEFT JOIN books b ON b.id = oi.book_id WHERE oi.order_id = o.id), '[]'::json) AS items
            FROM orders o
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
        `, [req.user.id]);

        return res.json(result.rows);
    } catch (err) {
        console.error('Ошибка в /api/orders:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/orders/:id/items', authMiddleware, async (req, res) => {
    try {
        const orderId = req.params.id;
        if (!orderId) return res.status(400).json({ error: 'Некорректный id заказа' });

        const own = await pool.query('SELECT id, user_id FROM orders WHERE id = $1', [orderId]);
        if (!own.rows.length) return res.status(404).json({ error: 'Заказ не найден' });
        if (req.user.role !== 'admin' && own.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к заказу' });
        }

        const itemsResult = await pool.query(`
            SELECT
                oi.book_id,
                b.title,
                b.author,
                b.cover_url,
                oi.quantity,
                oi.price_at_order AS price
            FROM order_items oi
            LEFT JOIN books b ON b.id = oi.book_id
            WHERE oi.order_id = $1
            ORDER BY oi.id
        `, [orderId]);

        const item_count = itemsResult.rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
        res.json({ items: itemsResult.rows, item_count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { items, delivery_address, promo_code } = req.body;
        if (!items || !items.length)
            return res.status(400).json({ error: 'Корзина пуста' });

        await client.query('BEGIN');
        let total = 0;
        const itemsData = [];
        for (const item of items) {
            const book = await client.query('SELECT id, price, stock FROM books WHERE id=$1 AND is_active=TRUE', [item.book_id]);
            if (!book.rows.length) throw new Error(`Книга ${item.book_id} не найдена`);
            if (book.rows[0].stock < item.quantity) throw new Error(`Недостаточно товара: ${item.book_id}`);
            total += book.rows[0].price * item.quantity;
            itemsData.push({ ...item, price: book.rows[0].price });
        }

        let discount = 0;
        if (promo_code) {
            const promo = await client.query(`SELECT discount_pct FROM promo_codes WHERE code=$1 AND is_active=TRUE AND (valid_until IS NULL OR valid_until >= NOW()::DATE) AND (max_uses IS NULL OR used_count < max_uses)`, [promo_code]);
            if (promo.rows.length) {
                discount = Math.round(total * promo.rows[0].discount_pct / 100);
                await client.query('UPDATE promo_codes SET used_count=used_count+1 WHERE id=$1', [promo.rows[0].id]);
            }
        }

        const order = await client.query(`INSERT INTO orders (user_id, total_amount, promo_code, discount_amount, delivery_address) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [req.user.id, total - discount, promo_code || null, discount, delivery_address || '']);
        const orderId = order.rows[0].id;

        for (const item of itemsData) {
            await client.query('INSERT INTO order_items (order_id, book_id, quantity, price_at_order) VALUES ($1,$2,$3,$4)', [orderId, item.book_id, item.quantity, item.price]);
            await client.query('UPDATE books SET stock=stock-$1 WHERE id=$2', [item.quantity, item.book_id]);
        }

        await client.query('DELETE FROM cart WHERE user_id=$1', [req.user.id]);
        await client.query('COMMIT');
        res.status(201).json({ id: orderId, total: total - discount });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.patch('/api/orders/:id', adminMiddleware, async (req, res) => {
    try {
        const { status, delivery_note, tracking_number } = req.body;
        const result = await pool.query(`UPDATE orders SET status = COALESCE($1, status), delivery_note = COALESCE($2, delivery_note), tracking_number = COALESCE($3, tracking_number) WHERE id=$4 RETURNING *`, [status || null, delivery_note || null, tracking_number || null, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Заказ не найден' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Корзина

app.get('/api/cart', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.quantity, c.added_at,
                   b.id AS book_id, b.title, b.author, b.price, b.old_price, b.cover_url, b.stock
            FROM cart c
            JOIN books b ON c.book_id = b.id
            WHERE c.user_id=$1
            ORDER BY c.added_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/cart', authMiddleware, async (req, res) => {
    try {
        const { book_id, quantity = 1 } = req.body;
        await pool.query(`INSERT INTO cart (user_id, book_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id, book_id) DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity`, [req.user.id, book_id, quantity]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.patch('/api/cart/:book_id', authMiddleware, async (req, res) => {
    try {
        const { quantity } = req.body;
        if (quantity < 1) {
            await pool.query('DELETE FROM cart WHERE user_id=$1 AND book_id=$2', [req.user.id, req.params.book_id]);
        } else {
            await pool.query('UPDATE cart SET quantity=$1 WHERE user_id=$2 AND book_id=$3', [quantity, req.user.id, req.params.book_id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/cart/:book_id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM cart WHERE user_id=$1 AND book_id=$2', [req.user.id, req.params.book_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Избраннир

app.get('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.id, f.added_at,
                   b.id AS book_id, b.title, b.author, b.price, b.cover_url
            FROM favorites f
            JOIN books b ON f.book_id = b.id
            WHERE f.user_id=$1
            ORDER BY f.added_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const { book_id } = req.body;
        await pool.query('INSERT INTO favorites (user_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, book_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/favorites/:book_id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM favorites WHERE user_id=$1 AND book_id=$2', [req.user.id, req.params.book_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Отзывы


app.get('/api/reviews', async (req, res) => {
    try {
        const { book_id, status = 'approved' } = req.query;
        let where = [`r.status=$1`];
        let params = [status];
        let i = 2;
        if (book_id) {
            where.push(`r.book_id=$${i++}`);
            params.push(book_id);
        }

        const result = await pool.query(`
            SELECT r.id, r.rating, r.text, r.status, r.created_at,
                   u.first_name, u.last_name, u.login
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE ${where.join(' AND ')}
            ORDER BY r.created_at DESC
        `, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/reviews/all', adminMiddleware, async (req, res) => {
    try {
        const { status } = req.query;
        let where = status ? `WHERE r.status=$1` : '';
        const result = await pool.query(`
            SELECT r.*, u.first_name, u.last_name, b.title AS book_title
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN books b ON r.book_id = b.id
            ${where}
            ORDER BY r.created_at DESC
        `, status ? [status] : []);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/reviews', authMiddleware, async (req, res) => {
    try {
        const { book_id, rating, text } = req.body;
        if (!rating || rating < 1 || rating > 5)
            return res.status(400).json({ error: 'Оценка от 1 до 5' });

        const result = await pool.query(`INSERT INTO reviews (user_id, book_id, rating, text) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, book_id) DO UPDATE SET rating=$3, text=$4, status='pending' RETURNING *`, [req.user.id, book_id, rating, text || null]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.patch('/api/reviews/:id', adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const result = await pool.query('UPDATE reviews SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Отзыв не найден' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/reviews/:id', adminMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM reviews WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// админ

app.get('/api/users', adminMiddleware, async (req, res) => {
    try {
        const { search } = req.query;
        let where = ['1=1'];
        let params = [];
        let i = 1;
        if (search) {
            where.push(`(u.first_name ILIKE $${i} OR u.email ILIKE $${i++})`);
            params.push(`%${search}%`);
        }
        const result = await pool.query(`
            SELECT u.id, u.login, u.email, u.first_name, u.last_name, u.role,
                   u.is_active, u.created_at,
                   COUNT(o.id) AS order_count
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE ${where.join(' AND ')}
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/users/:id', adminMiddleware, async (req, res) => {
    try {
        const { first_name, last_name, email, role, password, is_active } = req.body;
        const updates = [];
        const values = [];
        let i = 1;

        if (first_name !== undefined) { updates.push(`first_name=$${i++}`); values.push(first_name); }
        if (last_name !== undefined) { updates.push(`last_name=$${i++}`); values.push(last_name); }
        if (email !== undefined) { updates.push(`email=$${i++}`); values.push(email); }
        if (role !== undefined) { updates.push(`role=$${i++}`); values.push(role); }
        if (is_active !== undefined) { updates.push(`is_active=$${i++}`); values.push(is_active); }
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            updates.push(`password_hash=$${i++}`);
            values.push(hash);
        }

        if (!updates.length) return res.status(400).json({ error: 'Нет полей' });
        values.push(req.params.id);

        const result = await pool.query(`UPDATE users SET ${updates.join(',')} WHERE id=$${i} RETURNING id,login,email,first_name,last_name,role,is_active`, values);
        if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/users/:id', adminMiddleware, async (req, res) => {
    try {
        await pool.query('UPDATE users SET is_active=FALSE WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});



app.get('/api/genres', async (_, res) => res.json((await pool.query('SELECT * FROM genres ORDER BY name')).rows));
app.get('/api/publishers', async (_, res) => res.json((await pool.query('SELECT * FROM publishers ORDER BY name')).rows));
app.get('/api/cover-types', async (_, res) => res.json((await pool.query('SELECT * FROM cover_types ORDER BY name')).rows));

// история просмотров

app.post('/api/history', authMiddleware, async (req, res) => {
    try {
        const { book_id } = req.body;
        await pool.query('INSERT INTO view_history (user_id, book_id) VALUES ($1,$2)', [req.user.id, book_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/history', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (vh.book_id)
                   vh.book_id, vh.viewed_at,
                   b.title, b.author, b.price, b.cover_url
            FROM view_history vh
            JOIN books b ON vh.book_id = b.id
            WHERE vh.user_id=$1
            ORDER BY vh.book_id, vh.viewed_at DESC
            LIMIT 20
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// промо

app.get('/api/promo', adminMiddleware, async (_, res) => {
    try {
        res.json((await pool.query('SELECT * FROM promo_codes ORDER BY id DESC')).rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/promo/check', async (req, res) => {
    try {
        const { code } = req.body;
        const result = await pool.query(`SELECT discount_pct FROM promo_codes WHERE code=$1 AND is_active=TRUE AND (valid_until IS NULL OR valid_until >= NOW()::DATE) AND (max_uses IS NULL OR used_count < max_uses)`, [code]);
        if (!result.rows.length) return res.status(404).json({ error: 'Промокод не найден или истёк' });
        res.json({ discount_pct: result.rows[0].discount_pct });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Запуск сервера


app.listen(PORT, () => console.log(` Сервер запущен: http://localhost:${PORT}`));