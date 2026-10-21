const { groupItemsByY } = require('../lineUtils');

const applyGroupByYAxisAndassignAmountProperly = (
    tableDataByPage,
    headerPositionsByPage
) => {
    Object.keys(tableDataByPage).forEach(page => {

        const groupedRows = groupItemsByY(
            tableDataByPage[page],
            0.01
        );

        const debitX = headerPositionsByPage[page]?.DEBITS;
        const creditX = headerPositionsByPage[page]?.CREDITS;

        Object.values(groupedRows).forEach(group => {

            // sort row first
            group.sort((a, b) => a.x - b.x);

            const amounts = group.filter(item =>
                /^\d[\d,]*\.\d+$/.test(item.text)
            );
            // console.log(amounts);

            if (amounts.length >= 2) {
                amounts[0].x = debitX;
                amounts[1].x = creditX;
            }
        });

        // flatten AFTER amount correction
        tableDataByPage[page] = Object.values(groupedRows).flat();

        headerPositionsByPage[page] = Object.fromEntries(
            Object.entries(headerPositionsByPage[page] || {})
                .sort(([, y1], [, y2]) => y1 - y2)
        );
    });
};

module.exports = {
    applyGroupByYAxisAndassignAmountProperly
};