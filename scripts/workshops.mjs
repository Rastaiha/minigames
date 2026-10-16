import fs from 'node:fs/promises';
import path from 'node:path';
import {
  discoverWorkshops,
  publicationDirectory,
  repositoryRoot,
  runCommands,
  stageWorkshop,
  verifyWorkshop,
} from './lib/workshops.mjs';
import { prepareReadmePages, mergeReadmePages } from './lib/homepages.mjs';

try {
  const [action = 'list', id, extra] = process.argv.slice(2);
  const supported = [
    'list',
    'matrix',
    'has-pages',
    'install',
    'check',
    'build',
    'dev',
    'run',
    'verify',
    'ciSetup',
    'ciCheck',
    'prepare-readmes',
    'merge-readmes',
  ];
  if (
    !supported.includes(action) ||
    (action === 'run' && (!id || !extra)) ||
    (action === 'dev' && !id) ||
    (extra && action !== 'run')
  ) {
    throw new Error(
      'Usage: node scripts/workshops.mjs list|matrix|install|check|build|verify [YYYY/name], dev YYYY/name, or run YYYY/name <command>'
    );
  }
  const workshops = await discoverWorkshops();
  if (!workshops.length) throw new Error('No workshop.json manifests found');
  const selected = id
    ? workshops.filter((workshop) => workshop.id === id)
    : workshops;
  if (!selected.length) throw new Error(`Unknown workshop: ${id}`);
  if (action === 'matrix') {
    console.log(
      JSON.stringify({
        include: selected.map((workshop) => ({
          id: workshop.id,
          pages: Boolean(workshop.publish),
          continueOnError: workshop.continueOnError,
        })),
      })
    );
  } else if (action === 'has-pages') {
    console.log(selected.some((workshop) => workshop.publish));
  } else if (action === 'prepare-readmes') {
    await prepareReadmePages(selected);
  } else if (action === 'merge-readmes') {
    await mergeReadmePages(selected);
  } else if (action === 'list') {
    selected.forEach((workshop) =>
      console.log(`${workshop.id}\t${workshop.title}`)
    );
  } else {
    for (const workshop of selected) {
      if (action === 'verify') {
        if (workshop.publish)
          await verifyWorkshop(
            workshop,
            path.join(repositoryRoot, publicationDirectory, workshop.id)
          );
      } else {
        const command = action === 'run' ? extra : action;
        if (
          (action === 'dev' || action === 'run') &&
          !Object.hasOwn(workshop.commands, command)
        ) {
          throw new Error(`${workshop.id} has no ${command} command`);
        }
        await runCommands(workshop, command);
        if (action === 'build') await stageWorkshop(workshop);
      }
    }
    if (action === 'verify' && selected.some((workshop) => workshop.publish)) {
      await fs.writeFile(
        path.join(repositoryRoot, publicationDirectory, '.nojekyll'),
        ''
      );
      console.log('All declared public entries are present.');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
