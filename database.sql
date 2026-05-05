


CREATE EXTENSION IF NOT EXISTS "pgcrypto";




CREATE TABLE genres (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE publishers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE cover_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE literature_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50)  NOT NULL UNIQUE
);



CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login           VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(20),
    role            VARCHAR(20) NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user', 'admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();



CREATE TABLE books (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(500) NOT NULL,
    author              VARCHAR(300) NOT NULL,
    genre_id            INTEGER REFERENCES genres(id) ON DELETE SET NULL,
    publisher_id        INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
    cover_type_id       INTEGER REFERENCES cover_types(id) ON DELETE SET NULL,
    literature_type_id  INTEGER REFERENCES literature_types(id) ON DELETE SET NULL,
    year_published      SMALLINT,
    pages               INTEGER,
    weight_g            INTEGER,
    dimensions          VARCHAR(50),
    price               NUMERIC(10,2) NOT NULL,
    old_price           NUMERIC(10,2),
    stock               INTEGER NOT NULL DEFAULT 0,
    isbn                VARCHAR(20),
    cover_url           TEXT,
    description         TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_books_updated
    BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_books_genre    ON books(genre_id);
CREATE INDEX idx_books_price    ON books(price);
CREATE INDEX idx_books_active   ON books(is_active);

CREATE TABLE book_tags (
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);

CREATE INDEX idx_book_tags_tag ON book_tags(tag_id);



CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                        CHECK (status IN ('processing','confirmed','shipping','delivered','cancelled')),
    total_amount    NUMERIC(10,2) NOT NULL,
    promo_code      VARCHAR(50),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_address TEXT,
    tracking_number VARCHAR(100),
    delivery_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_orders_user    ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(status);


CREATE TABLE order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    quantity        SMALLINT NOT NULL CHECK (quantity > 0),
    price_at_order  NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_book  ON order_items(book_id);



CREATE TABLE cart (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    quantity    SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

CREATE INDEX idx_cart_user ON cart(user_id);



CREATE TABLE favorites (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);



CREATE TABLE reviews (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','hidden')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)   
);

CREATE INDEX idx_reviews_book   ON reviews(book_id);
CREATE INDEX idx_reviews_status ON reviews(status);



CREATE TABLE view_history (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_user ON view_history(user_id);



CREATE TABLE promo_codes (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    discount_pct    SMALLINT NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
    valid_until     DATE,
    max_uses        INTEGER,
    used_count      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);



INSERT INTO genres (name) VALUES
    ('Романы и проза'),
    ('Фантастика и фэнтези'),
    ('Детективы и триллеры'),
    ('Классическая литература'),
    ('Манга и комиксы'),
    ('Детские книги'),
    ('Психология и саморазвитие'),
    ('История и документальное'),
    ('Нон-фикшн');

INSERT INTO publishers (name) VALUES
    ('Эксмо'),
    ('АСТ'),
    ('Soda Press'),
    ('Альпина Паблишер'),
    ('МИФ');

INSERT INTO cover_types (name) VALUES
    ('Мягкий переплёт'),
    ('Твёрдый переплёт'),
    ('Суперобложка');

INSERT INTO literature_types (name) VALUES
    ('Художественная'),
    ('Нон-фикшн'),
    ('Учебная'),
    ('Детская'),
    ('Комиксы');

INSERT INTO tags (name, slug) VALUES
    ('Новинка', 'new'),
    ('Популярное', 'popular');

-- (пароль admin123)
INSERT INTO users (login, email, password_hash, first_name, last_name, role) VALUES
    ('admin', 'admin@chitai-strana.ru', '$2b$10$1.KSBdwrjJacRImUDpWpleJVH9Yzdhh9LBteT2exwt3iuow4udzsG', 'Администратор', '', 'admin');


INSERT INTO books (title, author, genre_id, publisher_id, cover_type_id, year_published, pages, price, old_price, stock, isbn, cover_url, description) VALUES
    (
        'Лишний в его игре',
        'Алёна Филипенко',
        1, 1, 1,
        2024, 416, 599, 707, 50,
        '978-5-04-180512-7',
        'https://content.img-gorod.ru/pim/products/images/33/d3/019c74c3-0eda-7522-a790-4d5ed11b33d3.jpg?width=2560&height=1494',
        'Даня и Ярослав — одноклассники и соседи, но живут в параллельных вселенных.'
    ),
    (
        'Наруто',
        'Масаси Кисимото',
        5, 1, 1,
        2024, 200, 1499, NULL, 100,
        NULL,
        'https://content.img-gorod.ru/pim/products/images/06/48/019c37b0-7d3a-7f1d-917b-bf4bb41c0648.jpg?width=2560&height=1494',
        'Культовая манга о юном ниндзя Наруто Удзумаки.'
    ),
    (
        'Спеши любить',
        'Николас Спаркс',
        1, 2, 1,
        2023, 320, 499, NULL, 75,
        NULL,
        'https://content.img-gorod.ru/pim/products/images/4b/96/018fa175-5ca2-73d5-89b0-2cade26b4b96.jpg?width=2560&height=1494',
        'Трогательная история любви от мастера романтической прозы.'
    );

INSERT INTO book_tags (book_id, tag_id) VALUES
    (1, 1),
    (2, 1),
    (3, 2);





CREATE OR REPLACE VIEW v_books_full AS
SELECT
    b.id,
    b.title,
    b.author,
    g.name          AS genre,
    p.name          AS publisher,
    ct.name         AS cover_type,
    lt.name         AS literature_type,
    b.year_published,
    b.pages,
    b.weight_g,
    b.dimensions,
    b.price,
    b.old_price,
    b.stock,
    b.isbn,
    b.cover_url,
    b.description,
    b.is_active,
    COALESCE(ROUND(AVG(r.rating)::NUMERIC, 1), 0) AS avg_rating,
    COUNT(r.id)                                    AS review_count
FROM books b
LEFT JOIN genres          g  ON b.genre_id           = g.id
LEFT JOIN publishers      p  ON b.publisher_id        = p.id
LEFT JOIN cover_types     ct ON b.cover_type_id       = ct.id
LEFT JOIN literature_types lt ON b.literature_type_id = lt.id
LEFT JOIN reviews         r  ON b.id = r.book_id AND r.status = 'approved'
GROUP BY b.id, g.name, p.name, ct.name, lt.name;


CREATE OR REPLACE VIEW v_orders_full AS
SELECT
    o.id,
    o.status,
    o.total_amount,
    o.promo_code,
    o.discount_amount,
    o.delivery_address,
    o.tracking_number,
    o.delivery_note,
    o.created_at,
    o.updated_at,
    u.id            AS user_id,
    u.login         AS user_login,
    u.email         AS user_email,
    u.first_name    AS user_first_name,
    u.last_name     AS user_last_name,
    u.phone         AS user_phone,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'book_id',   oi.book_id,
            'title',     bk.title,
            'author',    bk.author,
            'cover_url', bk.cover_url,
            'quantity',  oi.quantity,
            'price',     oi.price_at_order
        ) ORDER BY oi.id
    ) AS items
FROM orders o
JOIN users       u  ON o.user_id = u.id
JOIN order_items oi ON o.id      = oi.order_id
JOIN books       bk ON oi.book_id = bk.id
GROUP BY o.id, u.id;
