"""打包：生成可直接上传到服务器的 dist/lantern-orbs.zip。

用法（在项目根目录）：
    python tools/build.py            # 重新子集化字体 → 校验关卡 → 打包
    python tools/build.py --no-fonts # 跳过字体子集化（没装 fonttools 时）

也可以用 npm run build。
压缩包解压后的目录结构就是网站根目录（index.html 在最外层），零外网依赖。
"""
import hashlib
import pathlib
import re
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = DIST / "lantern-orbs.zip"

# 需要部署的文件：开发工具、原始字体、调参以外的东西都不放进去
INCLUDE = [
    "index.html",
    "style.css",
    "src/*.js",
    "lib/*.js",
    "fonts/*.woff",
    "fonts/OFL-*.txt",
]


def step(title: str) -> None:
    print(f"\n== {title} ==", flush=True)


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode != 0:
        sys.exit(f"失败：{' '.join(cmd)}")


def stamp(rel: str, data: bytes, ver: str) -> bytes:
    """给页面里引用的脚本/样式/字体加 ?v=版本号，防止浏览器混用新旧缓存（只改压缩包里的副本）"""
    q = f"?v={ver}"
    pats = {
        "index.html": r'(?<==")(style\.css|lib/pixi\.min\.js|src/main\.js)(?=")',
        "style.css": r'(?<=url\(")(fonts/[\w-]+\.woff)(?="\))',
    }
    pat = pats.get(rel)
    if rel.startswith("src/") and rel.endswith(".js"):
        pat = r"(?<=from ')(\./[\w-]+\.js)(?=')"
    if not pat:
        return data
    text = data.decode("utf-8")
    text, n = re.subn(pat, lambda m: m.group(1) + q, text)
    if rel in pats and n == 0:
        raise SystemExit(f"版本号替换失败：{rel}")
    return text.encode("utf-8")


def main() -> None:
    # 输出被管道/npm 接管时 Windows 默认用 GBK，统一成 UTF-8；真正的控制台不受影响
    if not sys.stdout.isatty():
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if "--no-fonts" not in sys.argv:
        step("字体子集化")
        run([sys.executable, "tools/subset-fonts.py"])

    step("关卡校验")
    run(["node", "tools/check-levels.mjs"])

    step("打包")
    files = sorted({p for pat in INCLUDE for p in ROOT.glob(pat) if p.is_file()})
    for must in ("index.html", "src/main.js", "lib/pixi.min.js"):
        if not (ROOT / must).exists():
            sys.exit(f"缺少文件：{must}")
    DIST.mkdir(exist_ok=True)
    total = 0
    h = hashlib.sha1()
    for p in files:
        h.update(p.read_bytes())
    ver = h.hexdigest()[:8]
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            rel = p.relative_to(ROOT).as_posix()
            z.writestr(rel, stamp(rel, p.read_bytes(), ver))
            total += p.stat().st_size
    print(f"{len(files)} 个文件，原始 {total / 1024:.0f} KB → {OUT.relative_to(ROOT).as_posix()} {OUT.stat().st_size / 1024:.0f} KB（版本 {ver}）")


if __name__ == "__main__":
    main()
