import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");
const contextFile = path.join(srcRoot, "context", "ApiAlertModalContext.jsx");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(jsx|js|tsx|ts)$/.test(name.name)) out.push(p);
  }
  return out;
}

function relToContext(fromFile) {
  let r = path.relative(path.dirname(fromFile), path.dirname(contextFile)).replace(/\\/g, "/");
  if (!r || r === ".") r = ".";
  if (!r.startsWith(".")) r = `./${r}`;
  return `${r}/ApiAlertModalContext.jsx`;
}

for (const file of walk(srcRoot)) {
  if (file.replace(/\\/g, "/").endsWith("context/ApiAlertModalContext.jsx")) continue;
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("useToast")) continue;

  const importLine = `import { useAppToast } from "${relToContext(file)}";\n`;

  s = s.replace(/,\s*useToast\s*/g, "");
  s = s.replace(/\{\s*useToast\s*,/g, "{");
  s = s.replace(/import\s*\{\s*useToast\s*\}\s*from\s*["']@chakra-ui\/react["'];?\s*\n?/g, "");

  if (!s.includes("useAppToast")) {
    const firstImp = s.search(/^import\s/m);
    if (firstImp === -1) continue;
    const endFirst = s.indexOf("\n", firstImp);
    s = s.slice(0, endFirst + 1) + importLine + s.slice(endFirst + 1);
  }

  s = s.replace(/\bconst\s+toast\s*=\s*useToast\s*\(\)/g, "const { toast } = useAppToast()");
  s = s.replace(/\blet\s+toast\s*=\s*useToast\s*\(\)/g, "const { toast } = useAppToast()");
  fs.writeFileSync(file, s);
  console.log("patched", path.relative(srcRoot, file));
}
