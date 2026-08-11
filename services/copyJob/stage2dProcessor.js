const { streamToString } = require("../../utils/streamUtils");

async function processStageBundle(fileData, metadata, s3Key) {
  console.log(`📦 Processing Stage2d bundle...`);

  const rawJson = await streamToString(fileData.Body);
  const { metadata: meta, tables } = JSON.parse(rawJson);

  const sales = tables.cash_sale_entries || [];
  const fields = tables.cash_entry_fields || [];

  // 🔹 Group by (entry_date [DATE], user_id, financial_year)
  const grouped = {};
  for (const sale of sales) {
    // Normalize timestamptz → YYYY-MM-DD
    const saleDate = new Date(sale.entry_date).toISOString().split("T")[0];
    const key = `${saleDate}_${sale.user_id}_${sale.financial_year}`;

    if (!grouped[key]) {
      grouped[key] = { cash_sales: [] };
    }

    const saleFields = fields
      .filter(f => f.cash_sale_entry_id === sale.id)
      .map(f => stripMeta(f, metadata.target_user_id, "cash_entry_fields", meta.groups[0], meta));

    grouped[key].cash_sales.push({
      cash_sale_entries: stripMeta(
        sale,
        metadata.target_user_id,
        "cash_sale_entries",
        meta.groups[0],
        meta
      ),
      cash_entry_fields: saleFields
    });

  }

  // 🔹 Flatten into records
  const records = Object.entries(grouped).map(([groupKey, data]) => {
    const [entry_date, user_id, financial_year] = groupKey.split("_");
    return {
      job_id: metadata.job_id,
      stage: metadata.stage,
      source_user_id: metadata.source_user_id,
      target_user_id: metadata.target_user_id,
      table_group: "cashSalesByDate",
      s3_key: s3Key,
      chunk_index: metadata.chunk_index,
      row_data: {
        entry_date,
        user_id: metadata.target_user_id,
        financial_year,
        cash_sales: data.cash_sales,
        latestJobId: meta.latestJobId || null,
      }
    };
  });

  console.log(`✅ Flattened ${records.length} grouped records for Stage2d`);
  return records;
}

/**
 * Strip metadata fields and inject target_user_id if table is userScoped
 */
function stripMeta(row, targetUserId, tableName, group, meta) {
  console.log(targetUserId);
  console.log(meta);
  const { createdAt, updatedAt, user_id, ...rest } = row;
  const isUserScoped =
    (group && group.userScoped && group.userScoped[tableName]) ||
    (meta.userScoped && meta.userScoped[tableName]) ||
    false;
  return isUserScoped ? { ...rest, user_id: targetUserId } : rest;
}

module.exports = { processStageBundle };
