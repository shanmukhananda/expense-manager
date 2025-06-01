# Expense Manager Application
This is a full-stack web application designed to help you track and manage your personal expenses. It features a user-friendly interface for recording daily spending and organizing financial data.

## PostgreSQL Setup (Local)

To run this application with a PostgreSQL database, you'll need to set it up locally.

1.  **Install PostgreSQL**:
    Install PostgreSQL on your system. You can find instructions for your operating system on the [official PostgreSQL website](https://www.postgresql.org/download/).

2.  **Create Database and User**:
    *   Open `psql` or your preferred PostgreSQL client.
    *   Create a new database:
        ```sql
        CREATE DATABASE expense_manager_db;
        ```
        (You can change `expense_manager_db` if you update the connection string in the application).
    *   Create a new user (replace `myuser` and `mypassword` with your desired credentials):
        ```sql
        CREATE USER myuser WITH PASSWORD 'mypassword';
        ```
    *   Grant privileges to the user for the database:
        ```sql
        GRANT ALL PRIVILEGES ON DATABASE expense_manager_db TO myuser;
        ```
    *   Connect to the new database:
        ```sql
        \c expense_manager_db
        ```
    *   Enable UUID extension if you plan to use UUIDs in the future (optional but good practice):
        ```sql
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        ```

3.  **Configure Application**:
    *   The application connects to PostgreSQL using a connection string. By default, it's `postgresql://user:password@localhost:5432/expense_manager_db` (see `src/models/database.js`).
    *   Update the username, password, and database name in `src/models/database.js` to match the user and database you just created, or set up environment variables if you modify the application to use them (recommended for production).

4.  **Schema Application**:
    *   When the application starts, it will attempt to apply the schema located in `src/models/schema.sql` to the connected database. Ensure the user you configured has permissions to create tables.

## How to Use:
- Install requried packages
    ```
    cd expense-manager
    npm install
    ```
- Start the Backend Server:
    ```
    cd server.js
    node server.js
    ```
    You should see a message indicating the server is running on http://localhost:3000.

- Access the Application:
    - Open your web browser and go to http://localhost:3000.

This application provides a simple yet effective way to keep your expenses organized!
