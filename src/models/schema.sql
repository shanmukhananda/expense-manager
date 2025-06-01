CREATE TABLE IF NOT EXISTS expense_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS payers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS payment_mode (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    expense_group_id INTEGER NOT NULL,
    expense_category_id INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    payment_mode_id INTEGER NOT NULL,
    date DATE NOT NULL,
    amount REAL NOT NULL,
    expense_description TEXT,
    FOREIGN KEY (expense_group_id) REFERENCES expense_groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (payer_id) REFERENCES payers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (payment_mode_id) REFERENCES payment_mode(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
