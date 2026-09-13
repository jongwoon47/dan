from pathlib import Path

p = Path("src/copy/ko.ts")
t = p.read_text(encoding="utf-8")
extras = {
    "detailMissingBody": "\uc694\uccad\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc5b4\uc694.",
    "avgHope": "\ud3c9\uade0 \ud76c\ub9dd\uac00",
    "priceDist": "\ud76c\ub9dd\uac00 \ubd84\ud3ec",
    "alreadyOwnedPrefix": "\uc774\ubbf8 \ub0b4 \ubb3c\uac74\uc73c\ub85c \ub4f1\ub85d\ub418\uc5b4 \uc788\uc5b4\uc694.",
    "leaveSellIntent": "\ud310\ub9e4 \uc758\ud5a5 \ub0a8\uae30\uae30",
    "buyerSide": "\uac19\uc740 \ubb3c\uac74\uc744 \ucc3e\uace0 \uc788\ub098\uc694? ",
    "registerSame": "\ub098\ub3c4 \ub4f1\ub85d",
    "typeChip": "type-chip",
}
if "avgHope" not in t:
    lines = [f'  "{k}": "{v}",' for k, v in extras.items()]
    t = t.replace("} as const;", "\n".join(lines) + "\n} as const;")
    p.write_text(t, encoding="utf-8")
    print("added")
else:
    print("skip")
