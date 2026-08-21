const { streamToString } = require("../../utils/streamUtils");

/**
 * Processor for Stage1b bundles (groups + independents)
 */
async function processStageBundle(fileData, metadata, s3Key) {
  console.log(`📦 Processing Stage1b bundle...`);

  const rawJson = await streamToString(fileData.Body);
  const { metadata: meta, tables } = JSON.parse(rawJson);
  console.log(meta);
  console.log(tables);

  const records = [];

  // 🔹 Process all groups (not just account)
  for (const group of meta.groups || []) {
    for (const parentTable of group.parents || []) {
      for (const parentRow of tables[parentTable] || []) {
        const rowData = {};
        rowData[parentTable] = stripMeta(
          parentRow,
          metadata.target_user_id,
          parentTable,
          group,
          meta
        );

        // Attach children
        for (const childTable of group.tables) {
          if (childTable === parentTable) continue;

          for (const [joinKey, parentKey] of Object.entries(group.joinKeys || {})) {
            const [childTableName, childCol] = joinKey.split(".");
            const [parentTableName, parentCol] = parentKey.split(".");

            if (childTableName === childTable && parentTableName === parentTable) {
              const childRows = (tables[childTable] || []).filter(
                c => c[childCol] === parentRow[parentCol]
              );
              if (childRows.length > 0) {
                // ✅ Always attach as array
                rowData[childTable] = childRows.map(c =>
                  stripMeta(c, metadata.target_user_id, childTable, group, meta)
                );
              }
            }
          }
        }

        // ✅ Push only once per parent row
        records.push({
          job_id: metadata.job_id,
          stage: metadata.stage,
          source_user_id: metadata.source_user_id,
          target_user_id: metadata.target_user_id,
          table_group: group.name,
          source_id: parentRow.id,
          s3_key: s3Key,
          chunk_index: metadata.chunk_index,
          is_backup: metadata.is_backup === "true",
          row_data: rowData
        });
      }
    }
  }

  console.log(records);
  console.log(`✅ Flattened ${records.length} records for Stage1b groups`);

  // 🔹 Process independent tables
  for (const tableName of meta.independent || meta.tables || []) {
    for (const row of tables[tableName] || []) {
      records.push({
        job_id: metadata.job_id,
        stage: metadata.stage,   // "2"
        source_user_id: metadata.source_user_id,
        target_user_id: metadata.target_user_id,
        table_name: tableName,
        source_id: row.id,
        s3_key: s3Key,
        chunk_index: metadata.chunk_index,
        is_backup: metadata.is_backup === "true",
        row_data: stripMeta(row, metadata.target_user_id, tableName, null, meta)
      });
    }
  }

  console.log(`✅ Flattened ${records.length} records for Stage1b`);
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
