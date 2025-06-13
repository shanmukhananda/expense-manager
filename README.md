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
    *   The application connects to PostgreSQL using a connection string. This connection string is provided through the application's UI (for initial setup) or API when establishing a database connection. It is no longer hardcoded in `src/models/database.js`.
    *   The typical format for a connection string is `postgresql://user:password@host:port/database_name`.
    *   **Note on Production Environments**: For production deployments, it is strongly recommended to use environment variables to supply database credentials and other sensitive configuration details. While the current application version may not directly read all configurations from environment variables, this is a security best practice.

4.  **Schema Application**:
    *   The database schema (defined in `src/models/schema.sql`) is applied automatically by the application when it first successfully connects to the database via the API. Ensure the database user account specified in your connection string has the necessary permissions to create tables and other schema elements.

## How to Use:
- Install requried packages
    ```
    cd expense-manager
    npm install
    ```
- Start the Backend Server:
    ```
    node server.js
    ```
    You should see a message indicating the server is running on http://localhost:3000.

- Access the Application:
    - Open your web browser and go to http://localhost:3000.

This application provides a simple yet effective way to keep your expenses organized!
