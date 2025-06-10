class CsvRowParser {
    constructor() {
    }

    _parseDate(dateStr, originalRowForRowContext, fieldName = 'Date') {
        if (!dateStr || String(dateStr).trim() === '') {
            console.warn(`CsvRowParser: Skipping row due to missing or empty ${fieldName} field:`, originalRowForRowContext);
            return null;
        }
        const dateParts = String(dateStr).split('-');
        if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
            const month = monthNames[dateParts[1]];
            const year = dateParts[2];
            if (month && day.length === 2 && /^\d{4}$/.test(year) && /^\d{2}$/.test(day) && parseInt(day, 10) > 0 && parseInt(day, 10) <= 31 && parseInt(month, 10) > 0 && parseInt(month, 10) <=12 ) {
                return `${year}-${month}-${day}`;
            } else {
                console.warn(`CsvRowParser: Skipping row due to invalid ${fieldName} components: ${dateStr}`, originalRowForRowContext);
                return null;
            }
        } else {
            console.warn(`CsvRowParser: Skipping row due to invalid ${fieldName} format (expected DD-Mon-YYYY): ${dateStr}`, originalRowForRowContext);
            return null;
        }
    }

    _parseAmount(amountStr, originalRowForRowContext, fieldName = 'Amount') {
        if (!amountStr || String(amountStr).trim() === '') {
            console.warn(`CsvRowParser: Skipping row due to missing or empty ${fieldName} field:`, originalRowForRowContext);
            return null;
        }
        const numericAmount = parseFloat(String(amountStr).trim());
        if (isNaN(numericAmount)) {
            console.warn(`CsvRowParser: Skipping row due to invalid ${fieldName}: ${amountStr}`, originalRowForRowContext);
            return null;
        }
        return numericAmount;
    }

    _validateParsedData(rowData, originalRow) {
        const {
            date, amount, categoryStr, groupStr, payerStr, modeStr
        } = rowData;

        if (date === null) return false;
        if (amount === null) return false;

        const requiredStringFields = {
            'Expense Category': categoryStr,
            'Expense Group': groupStr,
            'Payer': payerStr,
            'Payment mode': modeStr
        };
        for (const fieldName in requiredStringFields) {
            if (!requiredStringFields[fieldName] || String(requiredStringFields[fieldName]).trim() === '') {
                console.warn(`CsvRowParser: Skipping row due to missing or empty required field '${fieldName}':`, originalRow);
                return false;
            }
        }
        return true;
    }

    _validateHeaders(rawRow, requiredHeaders) {
        for (const header of requiredHeaders) {
            if (rawRow[header] === undefined) {
                console.warn(`CsvRowParser: Skipping row due to missing column header '${header}':`, rawRow);
                return false;
            }
        }
        return true;
    }

    parse(rawRow) {
        const requiredHeaders = ['Date', 'Amount', 'Expense Category', 'Expense Group', 'Payer', 'Payment mode'];
        if (!this._validateHeaders(rawRow, requiredHeaders)) {
            return null;
        }

        const dateStr = rawRow['Date'];
        const amountStr = rawRow['Amount'];
        const categoryStr = rawRow['Expense Category'];
        const descriptionStr = rawRow['Expense Description'] || '';
        const groupStr = rawRow['Expense Group'];
        const payerStr = rawRow['Payer'];
        const modeStr = rawRow['Payment mode'];

        const formattedDate = this._parseDate(dateStr, rawRow);
        const numericAmount = this._parseAmount(amountStr, rawRow);

        const parsedRowContent = {
            date: formattedDate,
            amount: numericAmount,
            categoryStr,
            groupStr,
            payerStr,
            modeStr
        };

        if (!this._validateParsedData(parsedRowContent, rawRow)) {
            return null;
        }

        return {
            date: formattedDate,
            amount: numericAmount,
            categoryStr: categoryStr.trim(),
            descriptionStr: descriptionStr.trim(),
            groupStr: groupStr.trim(),
            payerStr: payerStr.trim(),
            modeStr: modeStr.trim(),
            originalRow: rawRow
        };
    }
}

module.exports = CsvRowParser;
