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

The CSV file must include a header row with the following column names (order is flexible as long as headers are present):

-   `Date`: Date of the expense (e.g., "1-Jul-2024"). Expected format: DD-Mon-YYYY.
-   `Amount`: Monetary value of the expense (e.g., "120.50").
-   `Expense Category`: Category of the expense (e.g., "Groceries").
-   `Expense Description`: Brief description (e.g., "Weekly food supplies"). Optional.
-   `Expense Group`: Group for the expense (e.g., "Household").
-   `Payer`: Person or account that paid (e.g., "Alice").
-   `Payment mode`: Method of payment (e.g., "Credit Card").

**Example CSV data:**
```csv
Date,Amount,Expense Category,Expense Description,Expense Group,Payer,Payment mode
1-Jul-2024,120.50,Groceries,Weekly food supplies,Household,Alice,Credit Card
2-Jul-2024,45.00,Transport,City bus pass,Commute,Alice,Online Wallet
```

### Script Behavior

-   **Database Schema:** Applies the schema from `src/models/schema.sql` if tables don't exist.
-   **Dynamic Entity Creation:** `Expense Category`, `Expense Group`, `Payer`, and `Payment mode` values from the CSV are dynamically managed. If an entity with the given name doesn't exist in its respective table, it will be created. The script then uses the ID of the found or created entity when inserting the expense.
-   **Expense Insertion:** Validated rows from the CSV are inserted into the `expenses` table, linked to the appropriate category, group, payer, and payment mode.
-   **Data Validation:**
    *   **Required Fields:** `Date`, `Amount`, `Expense Category`, `Expense Group`, `Payer`, and `Payment mode` are mandatory. Rows missing any of these (or with empty values) will be skipped. `Expense Description` is optional.
    *   **Format Checks:** `Date` and `Amount` fields are validated for correct format.
    *   Skipped rows are reported with warnings.
-   **Logging:** Provides console output detailing its progress, including created/found entities, processed rows, insertions, warnings for skipped rows, and errors. Critical errors terminate the script.
