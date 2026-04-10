/**
 * 強制在專案根目錄執行 netlify dev。
 * 預設自動挑兩個本機可用埠（避免 3999 / 8892 / 14001 等被舊行程占用）。
 * 也可手動指定：NETLIFY_DEV_PORT、NETLIFY_STATIC_PORT（.env 或環境變數）。
 */
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");

function listen0() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : null;
      server.close((err) => {
        if (err) reject(err);
        else if (port) resolve(port);
        else reject(new Error("無法取得可用埠"));
      });
    });
  });
}

async function pickTwoPorts() {
  const a = await listen0();
  const b = await listen0();
  if (a === b) return pickTwoPorts();
  return { proxy: a, static: b };
}

(async function main() {
  process.chdir(root);

  let proxyPort = null;
  let staticPort = null;
  if (process.env.NETLIFY_DEV_PORT) {
    const n = parseInt(process.env.NETLIFY_DEV_PORT, 10);
    if (Number.isFinite(n)) proxyPort = n;
  }
  if (process.env.NETLIFY_STATIC_PORT) {
    const n = parseInt(process.env.NETLIFY_STATIC_PORT, 10);
    if (Number.isFinite(n)) staticPort = n;
  }

  if (proxyPort == null || staticPort == null) {
    const picked = await pickTwoPorts();
    if (proxyPort == null) proxyPort = picked.proxy;
    if (staticPort == null) staticPort = picked.static;
  }

  if (proxyPort === staticPort) {
    staticPort = await listen0();
  }

  const functionsDir = path.join(root, "netlify", "functions");
  const args = [
    "netlify",
    "dev",
    "--port",
    String(proxyPort),
    "--staticServerPort",
    String(staticPort),
    "--dir",
    root,
    "--functions",
    functionsDir,
  ];

  console.log(
    `\n本地埠：代理 ${proxyPort}（瀏覽器開這個）、靜態後端 ${staticPort}\n` +
      `範例：http://localhost:${proxyPort}/dashboard.html\n`,
  );

  await new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      cwd: root,
      shell: true,
      env: { ...process.env },
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  }).then((code) => process.exit(code));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
