const { streamToString } = require("../../utils/streamUtils");

/**
 * Processor for Stage2c bundles (cash independents + production_entries group)
 */
async function processStageBundle(fileData, metadata, s3Key) {
  console.log(`📦 Processing Stage2c bundle...`);

  const rawJson = await streamToString(fileData.Body);
  const { metadata: meta, tables } = JSON.parse(rawJson);

  const records = [];

  // 🔹 Process groups (production_entries self-join)
  for (const group of meta.groups || []) {
    if (group.joinType === "self" && group.parents.includes("production_entries")) {
      const allEntries = tables.production_entries || [];
      const roots = allEntries.filter(r => !r[group.childKey]);

      for (const root of roots) {
        const rowData = stripMeta(root, metadata.target_user_id, "production_entries", group, meta);

        // Attach immediate children
        const children = allEntries.filter(c => c[group.childKey] === root[group.parentKey]);
        if (children.length > 0) {
          rowData.production_entries = children.map(c =>
            stripMeta(c, metadata.target_user_id, "production_entries", group, meta)
          );
        }

        records.push({
          job_id: metadata.job_id,
          stage: metadata.stage,
          source_user_id: metadata.source_user_id,
          target_user_id: metadata.target_user_id,
          table_group: group.name,
          source_id: root.id,
          s3_key: s3Key,
          chunk_index: metadata.chunk_index,
          row_data: { production_entries: rowData }
        });
      }
    }
  }

  console.log(`✅ Flattened ${records.length} production_entries groups`);

  // 🔹 Process independent tables (cash_entries, cash_entries_batch)
  for (const tableName of meta.independent || []) {
    for (const row of tables[tableName] || []) {
      records.push({
        job_id: metadata.job_id,
        stage: metadata.stage,
        source_user_id: metadata.source_user_id,
        target_user_id: metadata.target_user_id,
        table_name: tableName,
        source_id: row.id,
        s3_key: s3Key,
        chunk_index: metadata.chunk_index,
        row_data: stripMeta(row, metadata.target_user_id, tableName, null, meta)
      });
    }
  }

  console.log(`✅ Flattened ${records.length} records total for Stage2c`);
  return records;
}

/**
 * Strip metadata fields and inject target_user_id if table is userScoped
 */
function stripMeta(row, targetUserId, tableName, group, meta) {
  const { createdAt, updatedAt, user_id, ...rest } = row;
  const isUserScoped =
    (group && group.userScoped && group.userScoped[tableName]) ||
    (meta.userScoped && meta.userScoped[tableName]) ||
    false;
  return isUserScoped ? { ...rest, user_id: targetUserId } : rest;
}

module.exports = { processStageBundle };
