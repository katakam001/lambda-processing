const { normalizeRowText } = require('./convertUtils.js');

const extractAccountName = (rowText) => {
    const cleanedText = normalizeRowText(rowText);
    const columns = cleanedText.includes(" | ")
        ? cleanedText.split(" | ").map(col => col.trim())
        : [cleanedText.trim()];

    // console.log("Original row:", rowText);
    // console.log("Cleaned text:", cleanedText);
    // console.log("Extracted account name:", columns[0]);

    return columns[0];  // ✅ Return only the first column as the account name
}

const mergeAccountsInGroups = (tableDataByPage) => {
    return tableDataByPage.map(group => {
        const accountMap = new Map();

        group.account_list.forEach(account => {
            const accountKey = account.account_name.toLowerCase().trim();

            if (!accountMap.has(accountKey)) {
                accountMap.set(accountKey, {
                    account_name: account.account_name,
                    place: account.place || "",
                    debit_amount: account.debit_amount ? parseFloat(account.debit_amount.replace(/,/g, "")) : 0,
                    credit_amount: account.credit_amount ? parseFloat(account.credit_amount.replace(/,/g, "")) : 0
                });
            } else {
                const existing = accountMap.get(accountKey);

                if (account.debit_amount) {
                    existing.debit_amount += parseFloat(account.debit_amount.replace(/,/g, "")) || 0;
                }

                if (account.credit_amount) {
                    existing.credit_amount += parseFloat(account.credit_amount.replace(/,/g, "")) || 0;
                }
            }
        });

        // ✅ Replace with merged account list
        group.account_list = Array.from(accountMap.values());

        return group;
    });
};

module.exports = { extractAccountName, mergeAccountsInGroups };