const fs = require('node:fs/promises');
const path = require('node:path');

async function updateReadme() {
  const { discoverWorkshops } = await import('./lib/workshops.mjs');
  const { projectHomepages, renderReadme } =
    await import('./lib/homepages.mjs');
  const root = path.resolve(__dirname, '..');
  const projects = projectHomepages(await discoverWorkshops(root));
  await fs.writeFile(path.join(root, 'README.md'), renderReadme(projects));
  console.log(
    `Updated root directory with ${projects.length} project homepage(s).`
  );
}

if (require.main === module) {
  updateReadme().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { updateReadme };
