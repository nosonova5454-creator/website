#!/usr/bin/env node
/**
 * Создаёт или обновляет пользователя admin с паролем admin123
 * в базе из .env (те же параметры, что у server.js).
 *
 * Запуск: npm run reset-admin
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const LOGIN = 'admin';
const EMAIL = 'admin@chitai-strana.ru';
const PASSWORD = 'admin123';

async function main() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'chitai_strana',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    });

    const hash = await bcrypt.hash(PASSWORD, 10);
    const sql = `
        INSERT INTO users (login, email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)
        ON CONFLICT (login) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            email = EXCLUDED.email,
            role = 'admin',
            is_active = TRUE
        RETURNING id, login, email, role;
    `;

    try {
        const r = await pool.query(sql, [
            LOGIN,
            EMAIL,
            hash,
            'Администратор',
            '',
        ]);
        const u = r.rows[0];
        console.log('Готово. Администратор:');
        console.log('  Логин:   ', u.login);
        console.log('  Email:   ', u.email);
        console.log('  Пароль:  ', PASSWORD);
        console.log('  Роль:    ', u.role);
    } catch (e) {
        console.error('Ошибка:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
