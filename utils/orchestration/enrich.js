const updateGroupsWithChequeNo = (groupedByY, headerXMap) => {
    Object.entries(groupedByY).forEach(([yKey, items]) => {
        const yFloat = parseFloat(yKey);

        for (const item of items) {
            const match = item.text.match(/CHQ\s*NO\s*(.+)/i);
            if (match && match[1]) {
                groupedByY[yKey].push({
                    text: match[1].trim(),
                    x: headerXMap["CHEQUE NO"],
                    y: yFloat
                });
                break; // Add only one Cheque No per row
            }
        }
    });
};

const cleanChequeNoFromAmount = (groupedByY, headerXMap, epsilon = 0.01) => {
    Object.entries(groupedByY).forEach(([yKey, items]) => {
        const yFloat = parseFloat(yKey);

        const chequeNoItem = items.find(i =>
            Math.abs(i.x - headerXMap["CHEQUE NO"]) < epsilon &&
            i.y === yFloat
        );

        if (!chequeNoItem) return;

        const chequeValue = chequeNoItem.text.trim();

        const amountItem = items.find(i =>
            i.y === yFloat &&
            (Math.abs(i.x - headerXMap["DEBIT"]) < epsilon || Math.abs(i.x - headerXMap["CREDIT"]) < epsilon) &&
            i.text.includes(chequeValue)
        );

        if (!amountItem) return;

        // Remove Cheque No fragment from amount field text
        const cleanedText = amountItem.text.replace(chequeValue, '').trim();

        amountItem.text = cleanedText;
    });
};


const processGroupsWithoutTotal = (
    groupedData,
    groupedRows,
    filteredRows,
    headerPositions,
    tolerance = 0.01
) => {
    groupedData.forEach(group => {
        if (group.group_total === "Missing") {
            let creditSum = 0, debitSum = 0;

            // ✅ Locate all rows related to this group and sum amounts
            groupedRows.forEach(row => {
                if (row.text.includes(group.group_name)) {
                    const rowWords = filteredRows.filter(word => Math.abs(word.y - row.y) <= tolerance);

                    const amountWords = rowWords.filter(word => word.x >= headerPositions["credit amount"])
                        .map(word => word.text);

                    if (amountWords.length === 2) {
                        creditSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                        debitSum += parseFloat(amountWords[1].replace(/,/g, "")) || 0;
                    } else if (amountWords.length === 1) {
                        const textX = rowWords.find(word => word.text === amountWords[0]).x;
                        const distanceToCredit = Math.abs(textX - headerPositions["credit amount"]);
                        const distanceToDebit = Math.abs(textX - headerPositions["debit amount"]);

                        if (distanceToCredit < distanceToDebit) {
                            creditSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                        } else {
                            debitSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                        }
                    }
                }
            });

            // ✅ Assign correct total based on highest sum
            group.group_total = (creditSum > debitSum ? creditSum : debitSum).toLocaleString("en-IN");
            group.isCredit = creditSum > debitSum;
            group.isDebit = debitSum > creditSum;
        }
    });
    // console.log(JSON.stringify(groupedData, null, 2));


    return groupedData;
};

const groupAccounts = (
    groupedData,
    groupedRows,
    filteredRows,
    headerPositions,
    state,
    tolerance = 0.01
) => {
    let { currentGroup, groupsWithoutTotal } = state;
    // console.log(currentGroup);
    // console.log(JSON.stringify(groupedData, null, 2));
    // console.log(groupsWithoutTotal);

    let groupedDataWithoutTotal = groupedData.filter(group => groupsWithoutTotal.has(group.group_name));


    // ✅ Remove all unfinalized groups before reprocessing on next page
    if (groupsWithoutTotal.size > 0) {
        groupedData = groupedData.filter(group => !groupsWithoutTotal.has(group.group_name));
    }

    // console.log(JSON.stringify(groupedData, null, 2));
    // console.log(groupedRows);
    // console.log(filteredRows);

    groupedRows.forEach(row => {
        if (row.text.toLowerCase().includes("group total")) {
            // ✅ Finalizing group when "Group Total" is found
            if (currentGroup) {
                const parts = row.text.split(":")[1].trim().split(" ");
                currentGroup.group_total = parts[0];
                currentGroup.isCredit = parts.includes("Cr");
                currentGroup.isDebit = parts.includes("Dr");
                groupedData.push(currentGroup);
                // ✅ Remove finalized group AND associated accounts from `groupsWithoutTotal`
                groupsWithoutTotal.delete(currentGroup.group_name);
                currentGroup.account_list.forEach(acc => groupsWithoutTotal.delete(acc.account_name));

            }
            currentGroup = null;
        } else if (!currentGroup) {
            // ✅ New group detected
            currentGroup = { group_name: row.text, account_list: [] };
            // console.log(row.text, row.y);
            groupsWithoutTotal.add(row.text);

        } else {
            // ✅ Extract account details using filteredRows with tolerance matching
            let credit_amount = "0";
            let debit_amount = "0";
            let account_name = row.text;
            // console.log(row.text, row.y);

            // ✅ Find matching words within a **small Y-axis tolerance**
            const rowWords = filteredRows.filter(word => Math.abs(word.y - row.y) <= tolerance);
            // console.log(rowWords);

            // ✅ Extract account name (only words appearing before credit header position)
            account_name = rowWords.filter(word => word.x < headerPositions["credit amount"])
                .map(word => word.text)
                .join(" ");

            // ✅ Get remaining words as potential amounts
            const amountWords = rowWords.filter(word => word.x >= headerPositions["credit amount"])
                .map(word => word.text);

            if (amountWords.length === 2) {
                // ✅ If two amounts are present → First is Credit, Second is Debit
                credit_amount = amountWords[0];
                debit_amount = amountWords[1];
            } else if (amountWords.length === 1) {
                // ✅ If only one amount exists → Assign based on proximity
                const textX = rowWords.find(word => word.text === amountWords[0]).x;
                const distanceToCredit = Math.abs(textX - headerPositions["credit amount"]);
                const distanceToDebit = Math.abs(textX - headerPositions["debit amount"]);

                if (distanceToCredit < distanceToDebit) {
                    credit_amount = amountWords[0];
                } else {
                    debit_amount = amountWords[0];
                }
            }

            currentGroup.account_list.push({
                account_name,
                credit_amount,
                debit_amount
            });
            groupsWithoutTotal.add(account_name); // ✅ Ensure accounts are tracked

        }
    });

    // ✅ Handle groups without "Group Total"
    groupedData.forEach(group => {
        // console.log(group);
        if (!group.group_total) { // ✅ Group missing "Group Total"
            let creditSum = 0, debitSum = 0;

            group.account_list.forEach(acc => {
                creditSum += parseFloat(acc.credit_amount.replace(/,/g, "")) || 0;
                debitSum += parseFloat(acc.debit_amount.replace(/,/g, "")) || 0;
            });

            // ✅ Assign correct total based on highest sum
            group.group_total = (creditSum > debitSum ? creditSum : debitSum).toLocaleString("en-IN"); // Indian formatting
            group.isCredit = creditSum > debitSum;
            group.isDebit = debitSum > creditSum;
        }
    });
    // const trailBalanceContinues = isTrailBalanceContinuing(pageNum, pageDataByPage);
    state.currentGroup = currentGroup;
    // ✅ Normalize group names before persisting to state
    const normalizedGroupsWithoutTotal = new Set(
        [...groupsWithoutTotal].map(name =>
            name.replace(/\d+[\d,.]*/g, "").trim()
        )
    );

    state.groupsWithoutTotal = normalizedGroupsWithoutTotal;

    // ✅ Clean up `groupsWithoutTotal` by removing any numeric amounts in the group name
    const cleanedGroups = new Set([...groupsWithoutTotal].map(groupName => {
        return groupName.replace(/\d+[\d,.]*/g, "").trim(); // ✅ Remove numbers from the group name
    }));

    if (groupsWithoutTotal.size > 0) {
        groupedDataWithoutTotal = groupedDataWithoutTotal.filter(group => groupsWithoutTotal.has(group.group_name));
    }

    // ✅ Add any missing groups from cleanedGroups
    cleanedGroups.forEach(groupName => {
        const alreadyExists = groupedDataWithoutTotal.some(group => group.group_name === groupName);

        if (!alreadyExists) {
            groupedData.push({
                group_name: groupName,
                group_total: "Missing",
                account_list: [],
                isCredit: false,
                isDebit: false
            });
        }
    });

    // ✅ Append all existing groupedDataWithoutTotal entries
    groupedData.push(...groupedDataWithoutTotal);

    // console.log(cleanedGroups);
    // console.log(JSON.stringify(groupedData, null, 2));
    groupedData = processGroupsWithoutTotal(groupedData, groupedRows, filteredRows, headerPositions);
    return groupedData;

};

module.exports = { updateGroupsWithChequeNo, cleanChequeNoFromAmount, processGroupsWithoutTotal, groupAccounts };
