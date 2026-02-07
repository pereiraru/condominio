import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting owner data cleanup...');

  const units = await prisma.unit.findMany({
    include: {
      owners: { orderBy: { startMonth: 'asc' } },
      user: true,
    },
  });

  for (const unit of units) {
    if (unit.owners.length <= 1) continue;

    console.log(`\nUnit ${unit.code}: ${unit.owners.length} owners found`);

    // Group owners by normalized name (very simple normalization)
    const normalize = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    const ownerGroups = new Map<string, any[]>();
    for (const owner of unit.owners) {
        const norm = normalize(owner.name);
        // Find if a similar enough name exists in the map
        let found = false;
        for (const [key, group] of ownerGroups.entries()) {
            if (key.includes(norm) || norm.includes(key)) {
                group.push(owner);
                found = true;
                break;
            }
        }
        if (!found) {
            ownerGroups.set(norm, [owner]);
        }
    }

    // Process each group of duplicates
    for (const [norm, group] of ownerGroups.entries()) {
        if (group.length > 1) {
            console.log(`  Merging ${group.length} duplicates for "${group[0].name}"...`);
            
            // Pick the best record (one with most info or longest name)
            const best = group.reduce((prev, curr) => {
                const prevScore = (prev.email ? 1 : 0) + (prev.telefone ? 1 : 0) + prev.name.length;
                const currScore = (curr.email ? 1 : 0) + (curr.telefone ? 1 : 0) + curr.name.length;
                return currScore > prevScore ? curr : prev;
            });

            const others = group.filter(o => o.id !== best.id);

            for (const other of others) {
                // Update users linked to this owner
                await prisma.user.updateMany({
                    where: { ownerId: other.id },
                    data: { ownerId: best.id }
                });

                // Delete the duplicate
                await prisma.owner.delete({ where: { id: other.id } });
                console.log(`    Deleted duplicate: "${other.name}" (ID: ${other.id})`);
            }
            
            // Refresh the group to just the 'best' one for later processing
            ownerGroups.set(norm, [best]);
        }
    }

    // Re-fetch owners after merging duplicates
    const remainingOwners = await prisma.owner.findMany({
        where: { unitId: unit.id },
        orderBy: { startMonth: 'asc' }
    });

    if (remainingOwners.length > 1) {
        console.log(`  Fixing periods for ${remainingOwners.length} distinct owners...`);
        for (let i = 0; i < remainingOwners.length - 1; i++) {
            const curr = await prisma.owner.findUnique({ where: { id: remainingOwners[i].id } });
            const next = await prisma.owner.findUnique({ where: { id: remainingOwners[i+1].id } });

            if (!curr || !next) continue;

            if (curr.endMonth === null) {
                // Determine end month based on next owner's start
                let nextStart = next.startMonth;
                
                if (!nextStart) {
                    // If next owner has no start month, assume they started when the previous one ended
                    // For this project, the data usually starts in 2024-01
                    nextStart = '2024-01';
                    await prisma.owner.update({
                        where: { id: next.id },
                        data: { startMonth: nextStart }
                    });
                    console.log(`    Set default startMonth=${nextStart} for "${next.name}"`);
                }
                
                // Set endMonth to the month before nextStart
                const [y, m] = nextStart.split('-').map(Number);
                let endY = y, endM = m - 1;
                if (endM === 0) {
                    endM = 12;
                    endY--;
                }
                const endMonth = `${endY}-${endM.toString().padStart(2, '0')}`;
                
                await prisma.owner.update({
                    where: { id: curr.id },
                    data: { endMonth }
                });
                console.log(`    Set endMonth=${endMonth} for "${curr.name}"`);
            }
        }
        
        // Ensure only the LAST one is current
        const last = remainingOwners[remainingOwners.length - 1];
        if (last.endMonth !== null) {
            await prisma.owner.update({
                where: { id: last.id },
                data: { endMonth: null }
            });
            console.log(`    Set current owner (endMonth=null) for "${last.name}"`);
        }
    } else if (remainingOwners.length === 1) {
        const lone = remainingOwners[0];
        if (lone.endMonth !== null) {
            await prisma.owner.update({
                where: { id: lone.id },
                data: { endMonth: null }
            });
            console.log(`    Set lone owner "${lone.name}" as current`);
        }
    }
  }

  console.log('\nCleanup complete!');
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());