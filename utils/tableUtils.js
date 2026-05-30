const removeTableBorders = (rows) => {
    return rows.map(row => ({
        text: cleanTableRow(row.text),
        y: row.y,
        x: row.x
    })).filter(row => row.text.length > 0); // ✅ Ensure empty rows are discarded
};

const cleanTableRow = (text) => {
    return text
        .replace(/[│─┬┼┌┐├┤└┘═]+/g, '')  // ✅ Remove decorative borders
        // .replace(/^\||\|$/g, '')        // ✅ Strip leading & trailing pipes
        // .replace(/\s*\|\s*\|\s*/g, ' | ') // ✅ Convert "||" into a proper separator
        .trim();
};

function injectFallbackTable(page, items, tableDataByPage) {
    tableDataByPage[page] = [...items];
    console.log(`📦 Fallback table injected for page ${page} using semantic match.`);
}

module.exports = { removeTableBorders, injectFallbackTable };

