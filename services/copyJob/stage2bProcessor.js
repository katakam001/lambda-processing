const { streamToString } = require("../../utils/streamUtils");

/**
 * Recursively attach children based on joinKeys
 */
function attachChildren(parentTable, parentRow, tables, group, meta, targetUserId) {
  // strip metadata + userScoped handling
  const rowData = stripMeta(parentRow, targetUserId, parentTable, group, meta);

  // loop through all joinKeys
  for (const [joinKey, parentKey] of Object.entries(group.joinKeys || {})) {
    const [childTable, childCol] = joinKey.split(".");
    const [parentTableName, parentCol] = parentKey.split(".");

    if (parentTableName === parentTable) {
      const childRows = (tables[childTable] || []).filter(
        c => c[childCol] === parentRow[parentCol]
      );

      if (childRows.length > 0) {
        // recurse for each child row
        rowData[childTable] = childRows.map(c =>
          attachChildren(childTable, c, tables, group, meta, targetUserId)
        );
      }
    }
  }

  return rowData;
}

/**
 * Processor for Stage bundles (multi-level linking)
 */
async function processStageBundle(fileData, metadata, s3Key) {
  console.log(`📦 Processing Stage bundle...`);

  const rawJson = await streamToString(fileData.Body);
  const { metadata: meta, tables } = JSON.parse(rawJson);

  const records = [];

  // 🔹 Process all groups
  for (const group of meta.groups || []) {
    for (const parentTable of group.parents || []) {
      for (const parentRow of tables[parentTable] || []) {
        const rowData = {};
        rowData[parentTable] = attachChildren(
          parentTable,
          parentRow,
          tables,
          group,
          meta,
          metadata.target_user_id
        );

        records.push({
          job_id: metadata.job_id,
          stage: metadata.stage,
          source_user_id: metadata.source_user_id,
          target_user_id: metadata.target_user_id,
          table_group: group.name,
          source_id: parentRow.id,
          s3_key: s3Key,
          chunk_index: metadata.chunk_index,
          row_data: rowData
        });
      }
    }
  }

  console.log(`✅ Flattened ${records.length} records for Stage groups`);

  // 🔹 Process independent tables (if any)
  for (const tableName of meta.independent || meta.tables || []) {
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

  console.log(`✅ Flattened ${records.length} records total`);
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
