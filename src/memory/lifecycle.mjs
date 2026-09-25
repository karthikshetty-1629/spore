export async function sporeWorkingMemory({ database, archive, memory_id, spore }) {
  const memory = database.getWorkingMemory(memory_id);
  if (!memory) throw new Error(`working memory not found: ${memory_id}`);

  const archived = await archive.archiveEvidence({
    spore_id: spore.spore_id,
    memory_id,
    run_id: memory.run_id,
    subject: spore.subject || memory.subject,
    payload: memory.payload,
    token_count: memory.token_count,
    archived_at: spore.created_at,
  });

  try {
    database.withTransaction(() => {
      database.saveSpore({
        ...spore,
        run_id: memory.run_id,
        subject: spore.subject || memory.subject,
        archive_pointer: archived.pointer,
      });
      const removed = database.deleteWorkingMemory(memory_id);
      if (removed !== 1) throw new Error(`working memory changed during transition: ${memory_id}`);
    });
  } catch (error) {
    await archive.remove(archived.pointer);
    throw error;
  }

  const dormant = database.getSpore(spore.spore_id);
  return {
    spore: dormant,
    archive: archived,
    context_removed: {
      memory_id,
      token_count: memory.token_count,
      payload_bytes: Buffer.byteLength(JSON.stringify(memory.payload)),
    },
    compact_spore_bytes: Buffer.byteLength(JSON.stringify(dormant)),
  };
}
