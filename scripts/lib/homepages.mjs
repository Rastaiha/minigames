import fs from 'node:fs/promises';
import path from 'node:path';
import {
  publicationDirectory,
  repositoryRoot,
  workshopEnvironment,
} from './workshops.mjs';

export function projectHomepages(workshops, environment = process.env) {
  return workshops
    .filter((workshop) => workshop.homepage)
    .map((workshop) => {
      const { SITE_URL, WORKSHOP_PUBLIC_PATH } = workshopEnvironment(
        workshop,
        environment
      );
      const homepage = workshop.homepage;
      const url = /^https?:\/\//.test(homepage)
        ? homepage
        : `${SITE_URL.replace(/\/$/, '')}${WORKSHOP_PUBLIC_PATH}/${homepage.split('/').map(encodeURIComponent).join('/')}`.replace(
            /\/index\.html$/,
            '/'
          );
      return { id: workshop.id, title: workshop.title, url };
    });
}

export function renderReadme(projects) {
  return [
    '# Rasta Minigames',
    '',
    'کارگاه‌ها و مینی‌گیم‌های مستقل رستا در پوشه‌های `YYYY/<project>/` قرار دارند. هر پروژه ساختار، فرانت‌اند، ابزار ساخت، وابستگی‌ها و بک‌اند خودش را مدیریت می‌کند.',
    '',
    'ابزارهای مشترک در `scripts/` و گردش‌کارهای CI و انتشار در `.github/workflows/` قرار دارند. [راهنمای پروژه‌ها](https://github.com/rastaiha/minigames/blob/main/docs/workshops.md).',
    '',
    '## صفحه‌های اصلی',
    '',
    ...projects.map(
      (project) =>
        '- `' + project.id + '/`: [' + project.url + '](' + project.url + ')'
    ),
    ...(projects.length ? [] : ['هنوز صفحهٔ اصلی‌ای ثبت نشده است.']),
    '',
  ].join('\n');
}

function markdownPage(title, markdown) {
  return `---\nlayout: default\ntitle: ${JSON.stringify(title)}\n---\n\n${markdown}`;
}

// Only explicit README homepages enter Jekyll. Workshop frontend output never does.
export async function prepareReadmePages(
  workshops,
  root = repositoryRoot,
  environment = process.env
) {
  const source = path.join(root, '.readme-pages');
  await fs.rm(source, { recursive: true, force: true });
  await fs.mkdir(source, { recursive: true });
  const config = {
    title: 'Rasta Minigames',
    url: environment.PAGES_SITE_URL ?? 'https://rastaiha.github.io',
    baseurl: (environment.PAGES_BASE_PATH ?? '/minigames').replace(/\/$/, ''),
    theme: 'jekyll-theme-primer',
    plugins: ['jekyll-seo-tag', 'jekyll-github-metadata'],
  };
  // JSON is valid YAML and keeps configuration strings correctly escaped.
  await fs.writeFile(
    path.join(source, '_config.yml'),
    JSON.stringify(config, null, 2)
  );
  await fs.writeFile(
    path.join(source, 'index.md'),
    markdownPage(
      config.title,
      await fs.readFile(path.join(root, 'README.md'), 'utf8')
    )
  );
  for (const workshop of workshops.filter(
    (item) => item.publish?.readmeHomepage
  )) {
    const markdown = await fs.readFile(
      path.join(root, publicationDirectory, workshop.id, 'README.md'),
      'utf8'
    );
    const destination = path.join(source, workshop.id, 'index.md');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, markdownPage(workshop.title, markdown));
  }
}

export async function mergeReadmePages(workshops, root = repositoryRoot) {
  const rendered = path.join(root, '.readme-site');
  const output = path.join(root, publicationDirectory);
  for (const entry of [
    'index.html',
    ...workshops
      .filter((item) => item.publish?.readmeHomepage)
      .map((item) => `${item.id}/index.html`),
  ]) {
    if (!(await fs.stat(path.join(rendered, entry))).isFile())
      throw new Error(`Missing rendered homepage: ${entry}`);
  }
  const files = [];
  async function collect(directory, relative = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      const relativeName = path.join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `Rendered homepage contains a symlink: ${relativeName}`
        );
      if (entry.isDirectory()) await collect(filename, relativeName);
      else if (entry.isFile()) files.push(relativeName);
    }
  }
  await collect(rendered);
  // Check every collision before copying anything, so an existing frontend stays intact.
  for (const filename of files) {
    try {
      const previous = await fs.readFile(path.join(output, filename));
      if (!previous.equals(await fs.readFile(path.join(rendered, filename)))) {
        throw new Error(
          `Rendered homepage would overwrite existing public output: ${filename}`
        );
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const filename of files) {
    await fs.mkdir(path.dirname(path.join(output, filename)), {
      recursive: true,
    });
    await fs.copyFile(
      path.join(rendered, filename),
      path.join(output, filename)
    );
  }
}
