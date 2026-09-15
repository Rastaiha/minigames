/**
 * Auto-generates and updates the list of HTML minigames and their GitHub Pages URLs in README.md.
 * Groups by directory and includes a directory-only tree structure.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_PAGE_URL = 'https://rastaiha.github.io/minigames';
const MARKER_START = '<!-- MINIGAMES_LIST:START -->';
const MARKER_END = '<!-- MINIGAMES_LIST:END -->';

function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
}

function getHtmlFiles(repoRoot) {
  try {
    const stdout = execSync('git ls-files "*.html"', { cwd: repoRoot, encoding: 'utf8' });
    return stdout.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch (err) {
    // Fallback if git fails: recursively scan directory
    const files = [];
    function scan(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.name.endsWith('.html')) {
          files.push(path.relative(repoRoot, full).replace(/\\/g, '/'));
        }
      }
    }
    scan(repoRoot);
    return files;
  }
}

function extractTitle(filePath, repoRoot) {
  try {
    const content = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
    const match = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match && match[1]) {
      // Clean up whitespace & newlines
      return match[1].replace(/\s+/g, ' ').trim();
    }
  } catch (err) {
    console.warn(`Could not read ${filePath}:`, err.message);
  }
  return path.basename(filePath);
}

function buildDirectoryTree(directories) {
  // Build a tree of directories (folders only, without files)
  const rootTree = {};

  for (const dir of directories) {
    const parts = dir.split('/').filter(Boolean);
    let curr = rootTree;
    for (const part of parts) {
      if (!curr[part]) curr[part] = {};
      curr = curr[part];
    }
  }

  const lines = ['```text', '📁 minigames (root)'];

  function printNode(node, prefix = '') {
    const keys = Object.keys(node);
    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${connector}📁 ${key}/`);
      printNode(node[key], prefix + (isLast ? '    ' : '│   '));
    });
  }

  printNode(rootTree);
  lines.push('```');
  return lines.join('\n');
}

function generateMarkdown(files, repoRoot) {
  // Organize by directory
  const dirMap = new Map();

  for (const file of files) {
    const normalizedPath = file.replace(/\\/g, '/');
    const dir = path.dirname(normalizedPath);
    const fileName = path.basename(normalizedPath);
    const title = extractTitle(normalizedPath, repoRoot);
    const pageUrl = `${BASE_PAGE_URL}/${normalizedPath}`;

    if (!dirMap.has(dir)) {
      dirMap.set(dir, []);
    }
    dirMap.get(dir).push({
      path: normalizedPath,
      fileName,
      title,
      pageUrl,
      isArchive: normalizedPath.includes('/archive/'),
    });
  }

  const sortedDirs = Array.from(dirMap.keys()).sort();
  const dirTree = buildDirectoryTree(sortedDirs);

  // Group active vs archive
  const activeDirs = sortedDirs.filter(d => !d.split('/').includes('archive'));
  const archiveDirs = sortedDirs.filter(d => d.split('/').includes('archive'));

  const output = [];

  output.push('### 🗂️ ساختار دایرکتوری‌های بازی‌ها (فقط پوشه‌ها)');
  output.push('');
  output.push('> در این بخش ساختار تمام پوشه‌هایی که شامل صفحات و مینی‌گیم‌ها هستند نمایش داده شده است:');
  output.push('');
  output.push(dirTree);
  output.push('');

  output.push('### 🎮 لیست بازی‌ها و لینک‌های GitHub Pages به تفکیک دایرکتوری');
  output.push('');
  output.push('| دایرکتوری (Folder) | عنوان صفحه / بازی | نام فایل | لینک اجرای زنده در GitHub Pages |');
  output.push('| :--- | :--- | :--- | :--- |');

  function renderRows(dirs) {
    for (const dir of dirs) {
      const items = dirMap.get(dir);
      items.forEach((item, index) => {
        const dirBadge = `📁 \`${dir}/\``;
        const fileBadge = `\`${item.fileName}\``;
        const liveLink = `[🌐 مشاهده و اجرا](${item.pageUrl})`;
        output.push(`| ${dirBadge} | **${item.title}** | ${fileBadge} | ${liveLink} |`);
      });
    }
  }

  renderRows(activeDirs);

  if (archiveDirs.length > 0) {
    output.push('');
    output.push('#### 📦 بخش آرشیو و نمونه‌های اولیه (`archive/`)');
    output.push('');
    output.push('| دایرکتوری (Folder) | عنوان صفحه / بازی | نام فایل | لینک اجرای زنده در GitHub Pages |');
    output.push('| :--- | :--- | :--- | :--- |');
    renderRows(archiveDirs);
  }

  output.push('');
  output.push(`*آخرین به‌روزرسانی خودکار: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC — تعداد کل صفحات: ${files.length}*`);

  return output.join('\n');
}

function updateReadme() {
  const repoRoot = getRepoRoot();
  console.log(`Scanning repository at: ${repoRoot}`);

  const htmlFiles = getHtmlFiles(repoRoot);
  console.log(`Found ${htmlFiles.length} HTML files.`);

  const generatedContent = generateMarkdown(htmlFiles, repoRoot);

  const readmePath = path.join(repoRoot, 'README.md');
  let readmeContent = '';

  if (fs.existsSync(readmePath)) {
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  } else {
    // Initial README template if file does not exist
    readmeContent = `# 🎮 Rasta LLM Minigames (مینی‌گیم‌های هوش مصنوعی رستا)

مجموعه‌ای از مینی‌گیم‌ها و ابزارهای تعاملی وب برای یادگیری مفاهیم مدل‌های بزرگ زبانی (LLM)، توکن‌سازی، بردار واژه‌ها، توجه (Attention)، و ایمنی مدل‌ها.

آدرس پایه گیت‌هاب پیج: [https://rastaiha.github.io/minigames/](https://rastaiha.github.io/minigames/)

---

## 📌 فهرست بازی‌ها و صفحات تعاملی

${MARKER_START}
${MARKER_END}

---

## 🛠️ به‌روزرسانی خودکار فهرست بازی‌ها

این لیست با اضافه یا حذف شدن هر فایل HTML به صورت کاملاً خودکار توسط **GitHub Actions** به‌روزرسانی می‌شود.
همچنین برای اجرای دستی در محیط محلی می‌توانید دستور زیر را اجرا نمایید:

\`\`\`bash
node scripts/update-readme.js
\`\`\`
`;
  }

  if (readmeContent.includes(MARKER_START) && readmeContent.includes(MARKER_END)) {
    const startIndex = readmeContent.indexOf(MARKER_START) + MARKER_START.length;
    const endIndex = readmeContent.indexOf(MARKER_END);
    readmeContent = readmeContent.substring(0, startIndex) + '\n' + generatedContent + '\n' + readmeContent.substring(endIndex);
  } else {
    readmeContent = readmeContent + '\n\n' + MARKER_START + '\n' + generatedContent + '\n' + MARKER_END + '\n';
  }

  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log(`Successfully updated ${readmePath}`);
}

if (require.main === module) {
  updateReadme();
}

module.exports = { updateReadme };
