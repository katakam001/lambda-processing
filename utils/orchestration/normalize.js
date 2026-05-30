const crypto = require('crypto');


const normalizeBankPDF = (pageRows, accountId, userId, financialYear) => {
    const normalized = [];

    for (const row of pageRows) {
        normalized.push(normalizeTransactionRow(row, accountId, userId, financialYear));
    }

    return normalized;
};

function normalizeTransactionRow(row, accountId, userId, financialYear) {
    const keys = Object.keys(row);
    const lowerMap = Object.fromEntries(keys.map(k => [k.toLowerCase(), k]));

    const rawDate = row[lowerMap['date']] || row[lowerMap['txn date']] || row[lowerMap['value date']] || row[lowerMap['transaction']] || row[lowerMap['value']] || row[lowerMap['trans date and']] || row[lowerMap['tran date']] || row[lowerMap['tran']] || row[lowerMap['tran. date']] || row[lowerMap['date(value']] || '';
    const formattedDate = standardizeDate(rawDate);
    // console.log(rawDate, formattedDate);

    const rawDebit = row[lowerMap['debit']] || row[lowerMap['debits']] || row[lowerMap['debit(rs)']] || row[lowerMap['withdrawal']] || row[lowerMap['withdrawals']] || row[lowerMap['withdrawal amount']] || row[lowerMap['withdrawals(rs.)']] || row[lowerMap['withdra']] || row[lowerMap['withdrawl']] || row[lowerMap['dr']] || row[lowerMap['debit amount']] || row[lowerMap['debit amt.']] || row[lowerMap['withdrawal (dr)']] || row[lowerMap['withdraws']] || row[lowerMap['debit in rs.']] || row[lowerMap['debit in']] || (row[lowerMap['amount(rs.)']]?.includes('Dr') ? row[lowerMap['amount(rs.)']] : '') || (row[lowerMap['amount(']]?.includes('Dr') ? row[lowerMap['amount(']] : '');
    const rawCredit = row[lowerMap['credit']] || row[lowerMap['credits']] || row[lowerMap['credit(rs)']] || row[lowerMap['deposit']] || row[lowerMap['deposits']] || row[lowerMap['deposit amount']] || row[lowerMap['deposits(rs.)']] || row[lowerMap['cr']] || row[lowerMap['credit amount']] || row[lowerMap['credit amt.']] || row[lowerMap['deposit (cr)']] || row[lowerMap['credit in rs.']] || row[lowerMap['credit in']] || (row[lowerMap['amount(rs.)']]?.includes('Cr') ? row[lowerMap['amount(rs.)']] : '') || (row[lowerMap['amount(']]?.includes('Cr') ? row[lowerMap['amount(']] : '');

    const debit = cleanAmount(rawDebit);
    const credit = cleanAmount(rawCredit);
    // Mutual exclusion rule
    const finalDebit = debit !== '0.00' ? debit : '0.00';
    const finalCredit = credit !== '0.00' ? credit : '0.00';

    const balanceRaw = row[lowerMap['balance']] || row[lowerMap['balance(rs)']] || row[lowerMap['balance(rs.)']] || row[lowerMap['balancer']] || row[lowerMap['available bal.']] || row[lowerMap['closing balance*']] || row[lowerMap['closing balance']] || row[lowerMap['balance(']] || row[lowerMap['balance amt.']] || row[lowerMap['balance in rs.']] || row[lowerMap['balance(inr)']] || '';
    const balance = balanceRaw ? cleanAmount(balanceRaw) : '0.00';

    // let reference = row[lowerMap['transaction id']] || row[lowerMap['ref no./cheque']] || row[lowerMap['ref/cheque']] || row[lowerMap['cheque no']] || row[lowerMap['cheque no.']] || row[lowerMap['cheque']] || row[lowerMap['chq no']] || row[lowerMap['chq./ref.no.']] || row[lowerMap['chq-no']] || row[lowerMap['id']] || '';

    const description = row[lowerMap['remarks']] || row[lowerMap['description']] || row[lowerMap['narration']] || row[lowerMap['particulars']] || row[lowerMap['transaction details']] || row[lowerMap['details']] || row[lowerMap['account description']] || row[lowerMap['tran. particulars']] || '';

    const finalAmount = finalDebit !== '0.00' ? finalDebit : finalCredit;
    const fingerprint = `${formattedDate}|${description.trim()}|${finalAmount}`;
    const scopedInput = `${accountId}|${userId}|${financialYear}|${fingerprint}`;
    const reference = generateReference(scopedInput);

    return {
        date: formattedDate,
        description,
        reference,
        debit: finalDebit,
        credit: finalCredit,
        balance
    };
}

function generateReference(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}



function standardizeDate(dateStr = '') {
    const trimmed = dateStr.trim();

    // ✅ Match DD-MMM-YYYY HH:MM:SS (e.g. 31-MAR-2025 23:31:36)
    const ddMmmYyyyTimeMatch = trimmed.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (ddMmmYyyyTimeMatch) {
        const [_, dd, mmm, yyyy, hh, mm, ss] = ddMmmYyyyTimeMatch;
        const normalized = new Date(`${dd} ${mmm} ${yyyy} ${hh}:${mm}:${ss}`);
        if (!isNaN(normalized)) {
            const day = String(normalized.getDate()).padStart(2, '0');
            const month = String(normalized.getMonth() + 1).padStart(2, '0');
            const year = normalized.getFullYear(); // ✅ full 4-digit year
            return `${day}/${month}/${year}`;
        }
    }

    // ✅ Match DD-MM-YYYY HH:MM:SS or DD/MM/YYYY HH:MM:SS
    const datetimeMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (datetimeMatch) {
        const [_, dd, mm, yyyy] = datetimeMatch;
        const isoStr = `${yyyy}-${mm}-${dd}T${datetimeMatch[4]}:${datetimeMatch[5]}:${datetimeMatch[6]}`;
        const parsed = new Date(isoStr);
        if (!isNaN(parsed)) {
            return `${dd}/${mm}/${yyyy}`;
        }
    }

    // Match DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
        const [_, dd, mm, yyyy] = ddmmyyyyMatch;
        const isoStr = `${yyyy}-${mm}-${dd}`; // ISO-compatible format
        const parsed = new Date(isoStr);
        if (!isNaN(parsed)) {
            return `${dd}/${mm}/${yyyy}`;
        }
    }

    // ✅ Match DD-MM-YY or DD/MM/YY
    const ddmmyyMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (ddmmyyMatch) {
        const [_, dd, mm, yy] = ddmmyyMatch;
        const yyyy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`; // Adjust century logic if needed
        const isoStr = `${yyyy}-${mm}-${dd}`;
        const parsed = new Date(isoStr);
        if (!isNaN(parsed)) {
            return `${dd}/${mm}/${yyyy}`;
        }
    }

    // ✅ Match DD-MMM-YY (e.g. 11-Mar-25)
    if (/^\d{2}-[A-Za-z]{3}-\d{2}$/.test(trimmed)) {
        const normalized = new Date(trimmed.replace(/-/g, ' ')); // '11 Mar 25'
        if (!isNaN(normalized)) {
            let yyyy = normalized.getFullYear();
            if (yyyy < 100) {
                yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
            }
            const dd = String(normalized.getDate()).padStart(2, '0');
            const mm = String(normalized.getMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}/${yyyy}`;
        }
        return null;
    }

    // Continue with known formats...
    const knownFormats = [
        { regex: /^\d{2}-[A-Za-z]{3}-\d{4}$/, format: 'DD/MMM/YYYY' },
        { regex: /^[A-Za-z]{3} \d{2} \d{4}$/, format: 'MMM DD YYYY' },
        { regex: /^\d{2}\/[A-Za-z]{3}\/\d{4}$/, format: 'DD/MMM/YYYY' },
        { regex: /^\d{2}-[A-Z]{3}-\d{4}$/, format: 'DD/MMM/YYYY' },
        { regex: /^\d{2} [A-Za-z]{3} \d{4}$/, format: 'DD/MMM/YYYY' },
        { regex: /^[A-Za-z]{3} \d{1,2} \d{4}$/, format: 'MMM DD YYYY' }
    ];

    for (const { regex } of knownFormats) {
        if (regex.test(trimmed)) {
            const normalized = new Date(trimmed.replace(/-/g, '/').replace(/ +/g, ' '));
            if (!isNaN(normalized)) {
                const dd = String(normalized.getDate()).padStart(2, '0');
                const mm = String(normalized.getMonth() + 1).padStart(2, '0');
                const yyyy = normalized.getFullYear();
                return `${dd}/${mm}/${yyyy}`;
            }
        }
    }

    // Final fallback
    const loose = new Date(trimmed);
    if (!isNaN(loose)) {
        const dd = String(loose.getDate()).padStart(2, '0');
        const mm = String(loose.getMonth() + 1).padStart(2, '0');
        const yyyy = loose.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    return trimmed;
}

function cleanAmount(value = '') {
    const cleaned = value.replace(/₹|INR|\(|\)|Cr|CR|Dr|DR|-|,/gi, '').trim();

    // Check if cleaned is a valid number
    if (cleaned && !isNaN(cleaned)) {
        // Regex: only digits, optional decimal part with digits
        const validNumberPattern = /^\d+(\.\d+)?$/;

        if (validNumberPattern.test(cleaned)) {
            // If it has a proper decimal part, return as-is
            if (cleaned.includes('.')) {
                return cleaned;
            } else {
                // Append .00 if integer
                return `${cleaned}.00`;
            }
        }
    }
    return '0.00';
}
module.exports = { normalizeBankPDF };
