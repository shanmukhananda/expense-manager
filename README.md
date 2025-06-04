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


## CSV Import Script (`import_csv.js`)

This script allows you to import expense data from a CSV file into the application's PostgreSQL database.

### Prerequisites

- Node.js (version X.X.X or later recommended)
- Access to a running PostgreSQL server.
- Project dependencies installed: Run `npm install` in the project root directory.

### Usage

Execute the script from the project root directory using the following command:

```bash
node import_csv.js --database_url "postgres://username:password@host:port/database_name" --csv_path "./path/to/your/data.csv"
```

**Arguments:**

-   `--database_url` (or `--db`): **Required**. The full connection URL for your PostgreSQL database.
    Format: `postgres://username:password@host:port/database_name`
-   `--csv_path` (or `--csv`): **Required**. The file path to the CSV file containing the expense data.

### CSV File Format

The CSV file must have a header row and the following columns in order:

1.  `Date`: The date of the expense (e.g., "1-Jun-2025"). The script expects day-month-year format.
2.  `Amount`: The monetary value of the expense (e.g., "250.75").
3.  `Category`: The category of the expense (e.g., "Utilities", "Groceries").
4.  `Description`: A brief description of the expense (e.g., "Monthly electricity bill").

**Example CSV data:**
```csv
Date,Amount,Category,Description
1-Jun-2025,26250,Rent,house rent
2-Jun-2025,75.50,Groceries,Weekly shopping
```

### Script Behavior

-   **Database Schema:** The script will attempt to apply the database schema defined in `src/models/schema.sql` if the tables do not already exist. This is handled by the `DatabaseManager` class used by the script.
-   **Default Entities:** It will find or create default records in the `expense_groups`, `payers`, and `payment_mode` tables (e.g., "CSV Imports Default Group", "CSV Imports Default Payer", "CSV Imports Default Mode"). These defaults are used for the corresponding fields in the imported expenses.
-   **Categories:** If a category specified in the CSV file does not exist in the `expense_categories` table, the script will create it.
-   **Expense Insertion:** Validated and processed data from the CSV will be inserted into the `expenses` table. Each row is processed individually.
-   **Logging:** The script provides console output detailing its progress, including successful operations, warnings for skipped rows, and any errors encountered. Critical errors will terminate the script.
-   **Validation:** The script validates required fields (Date, Amount, Category) and formats for Date and Amount. Rows failing validation are skipped.
