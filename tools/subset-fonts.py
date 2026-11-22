"""字体子集化：只保留游戏里实际用到的字，生成很小的 woff 字体放进 fonts/。

用法（在项目根目录）：
    python tools/subset-fonts.py

什么时候需要重新运行：给游戏加了新的中文文字（关卡名、提示语等）之后。
原始字体放在 tools/fontsrc/（只用于开发，不需要部署到服务器）。
依赖：pip install fonttools
"""
import pathlib
import re
import shutil

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "fontsrc"
OUT = ROOT / "fonts"

# 收集项目源码里出现的所有字符
SOURCES = [ROOT / "index.html", ROOT / "style.css", *sorted((ROOT / "src").glob("*.js"))]
ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
EXTRA = "·…—“”‘’《》「」『』，。！？：；、（）★☆×÷％"


def strip_comments(text: str) -> str:
    # 代码注释里的中文不会显示在界面上，去掉以减小字体体积
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return re.sub(r"(^|[^:'\"])//[^\n]*", r"\1", text)


def used_chars() -> str:
    text = "".join(strip_comments(p.read_text(encoding="utf-8")) for p in SOURCES)
    cjk = set(re.findall(r"[^\x00-\x7f]", text))
    return "".join(sorted(cjk | set(ASCII) | set(EXTRA)))


# 原字体里有缺陷的字形
#   reverse：需要反转绕向的轮廓序号；holes：需要补上的矩形内孔 (x0, y0, x1, y1)
# ZCOOL XiaoWei 的「回」：外框内孔绕向错误被填实、内框缺少内孔，整个字显示成实心方块
GLYPH_FIXES = {
    "ZCOOLXiaoWei-Regular.ttf": {"回": {"reverse": [2], "holes": [(436, 296, 586, 512)]}},
}


def fix_glyphs(font, fixes: dict) -> None:
    cmap = font.getBestCmap()
    glyf = font["glyf"]
    for ch, fix in fixes.items():
        name = cmap.get(ord(ch))
        if not name:
            continue
        g = glyf[name]
        coords, ends = list(g.coordinates), list(g.endPtsOfContours)
        flags = list(g.flags)
        start = 0
        for i, end in enumerate(ends):
            if i in fix.get("reverse", []):
                coords[start:end + 1] = coords[start:end + 1][::-1]
                flags[start:end + 1] = flags[start:end + 1][::-1]
            start = end + 1
        for x0, y0, x1, y1 in fix.get("holes", []):
            # 逆时针矩形 = 内孔（TrueType 外轮廓为顺时针）
            coords += [(x1, y1), (x0, y1), (x0, y0), (x1, y0)]
            flags += [1, 1, 1, 1]
            ends.append(len(coords) - 1)
        g.coordinates = type(g.coordinates)(coords)
        g.flags = type(g.flags)(flags)
        g.endPtsOfContours = ends
        g.numberOfContours = len(ends)
        g.recalcBounds(glyf)
        print(f"  已修复字形「{ch}」")


def make(src_name: str, out_name: str, chars: str) -> None:
    opts = subset.Options()
    opts.flavor = "woff"            # woff2 需要额外安装 brotli；woff 无需依赖，所有浏览器都支持
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.desubroutinize = True
    # 去掉 TrueType 微调指令：指令按点序号操作，修复字形后会错位；游戏里的字都比较大，不需要微调
    opts.hinting = False
    font = subset.load_font(str(SRC / src_name), opts)
    if src_name in GLYPH_FIXES:
        fix_glyphs(font, GLYPH_FIXES[src_name])
    sub = subset.Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    out = OUT / out_name
    subset.save_font(font, str(out), opts)
    print(f"  {out_name:28s} {out.stat().st_size / 1024:7.1f} KB")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    chars = used_chars()
    print(f"收集到 {len(chars)} 个字符，生成字体：")
    make("MaShanZheng-Regular.ttf", "MaShanZheng-subset.woff", chars)
    make("ZCOOLXiaoWei-Regular.ttf", "ZCOOLXiaoWei-subset.woff", chars)
    make("Cinzel.ttf", "Cinzel-subset.woff", ASCII + EXTRA)
    for lic in SRC.glob("OFL-*.txt"):
        shutil.copy(lic, OUT / lic.name)
    print("完成。字体许可证（SIL OFL 1.1）已一并复制到 fonts/。")


if __name__ == "__main__":
    main()
