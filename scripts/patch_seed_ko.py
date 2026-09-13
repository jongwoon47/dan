# -*- coding: utf-8 -*-
from pathlib import Path

def s(*codes: int) -> str:
    return "".join(chr(c) for c in codes)

# Korean strings as codepoints to avoid editor encoding issues.
REP = {
    'title: "Sony A7 IV · weekend"': 'title: "' + s(0x7740,0xBC88,0x20,0xC8FC,0xB9D0,0x20) + 'Sony A7 IV ' + s(0xBE4C,0xB9AC,0xACE0,0x20,0xC2F6,0xC5B4,0xC694) + '"',
}
# Simpler: write full unicode escape map
strings = {
    "t_borrow_a7": "\uc774\ubc88 \uc8fc\ub9d0 Sony A7 IV \ube4c\ub9ac\uace0 \uc2f6\uc5b4\uc694",
    "d_borrow_a7": "\uceec\uc601\uc6a9\uc73c\ub85c \ud1a0\u00b7\uc77c \uc774\ud2c0\ub9cc \ube4c\ub824\uc694.",
    "t_tent": "\ucea0\ud551 \ud150\ud2b8 2\ubc15 \ube4c\ub824\uc694",
    "d_tent": "2\u20133\uc778\uc6a9 \ud150\ud2b8\uba74 \ucda9\ubd84\ud574\uc694.",
    "t_proj": "\ube44\ud504\ub85c\uc81d\ud130 \ud558\ub8e8\ub9cc \ube4c\ub824\uc8fc\uc2e4 \ubd84",
    "d_proj": "\ubaa8\uc784 \ubc1c\ud45c\uc6a9\uc73c\ub85c \uc800\ub141 \ud55c \ud0c0\uc784\ub9cc \ud544\uc694\ud574\uc694.",
    "t_doc": "\uc624\ub298 8\uc2dc \uc804\uc5d0 \uc11c\ub958 \ud558\ub098 \ubc1b\uc544\uc8fc\uc2e4 \ubd84",
    "d_doc": "\ud3c9\ud0dd\uc5d0\uc11c \uc11c\ub958 \ud53d\uc5c5\ub9cc \ubd80\ud0c1\ub4dc\ub824\uc694.",
    "t_cake": "\uc624\ub298 \uac15\ub0a8\uc5d0\uc11c \ucf00\uc774\ud06c \ud53d\uc5c5\ud574\uc8fc\uc2e4 \ubd84",
    "d_cake": "\ucf00\uc774\ud06c \uac00\uac8c\uc5d0\uc11c \ubc1b\uc544\uc11c \uadfc\ucc98\uae4c\uc9c0\ub9cc \uc640\uc8fc\uc154\ub3c4 \ub429\ub2c8\ub2e4.",
    "t_ikea": "\uc774\ucf00\uc544 \ucc45\uc0c1 \uc870\ub9bd\ud574\uc8fc\uc2e4 \ubd84",
    "d_ikea": "\uc131\ub3d9\uad6c\uc5d0\uc11c \uac04\ub2e8\ud55c \ucc45\uc0c1 \uc870\ub9bd \ub3c4\uc640\uc8fc\uc138\uc694.",
    "t_photo": "\uc624\ub298 \uac04\ub2e8\ud55c \uc0ac\uc9c4 \ucd2c\uc601\ud574\uc8fc\uc2e4 \ubd84",
    "d_photo": "\ud504\ub85c\ud544\uc6a9\uc73c\ub85c 30\ubd84\ub9cc \ucc0d\uc5b4\uc8fc\uc138\uc694.",
    "t_move": "\uc9d0 \uc870\uae08 \uc62e\uae30\ub294 \uac83 \ub3c4\uc640\uc8fc\uc2e4 \ubd84",
    "d_move": "\uc0c1\uc790 \uba87 \uac1c\ub9cc \uc5d8\ub9ac\ubca0\uc774\ud130\uae4c\uc9c0 \uac19\uc774 \uc62e\uaca8\uc694.",
    "i_tent": "\ucea0\ud551 \ud150\ud2b8",
    "i_proj": "\ube44\ud504\ub85c\uc81d\ud130",
    "td_doc": "\uc11c\ub958 \ud53d\uc5c5 \ub300\ud589",
    "td_cake": "\ucf00\uc774\ud06c \ud53d\uc5c5",
    "td_ikea": "\uc774\ucf00\uc544 \ucc45\uc0c1 \uc870\ub9bd",
    "sd_photo": "\uc9e7\uc740 \ud504\ub85c\ud544 \ucd2c\uc601",
    "sd_move": "\uac04\ub2e8 \uc9d0 \uc774\ub3d9 \ub3c4\uc6c0",
}

pairs = [
    ('title: "Sony A7 IV · weekend"', f'title: "{strings["t_borrow_a7"]}"'),
    ('description: "Sat-Sun rental"', f'description: "{strings["d_borrow_a7"]}"'),
    ('title: "Camping tent · 2 nights"', f'title: "{strings["t_tent"]}"'),
    ('description: "2-3 person tent"', f'description: "{strings["d_tent"]}"'),
    ('title: "Projector · 1 evening"', f'title: "{strings["t_proj"]}"'),
    ('description: "Meetup presentation"', f'description: "{strings["d_proj"]}"'),
    ('title: "Document pickup before 8pm"', f'title: "{strings["t_doc"]}"'),
    ('description: "Pickup in Pyeongtaek"', f'description: "{strings["d_doc"]}"'),
    ('title: "Cake pickup in Gangnam"', f'title: "{strings["t_cake"]}"'),
    ('description: "Today cake shop pickup"', f'description: "{strings["d_cake"]}"'),
    ('title: "IKEA desk assembly"', f'title: "{strings["t_ikea"]}"'),
    ('description: "Simple desk build help"', f'description: "{strings["d_ikea"]}"'),
    ('title: "Short profile photo shoot"', f'title: "{strings["t_photo"]}"'),
    ('description: "30 min profile photos"', f'description: "{strings["d_photo"]}"'),
    ('title: "Help moving a few boxes"', f'title: "{strings["t_move"]}"'),
    ('description: "Boxes to elevator"', f'description: "{strings["d_move"]}"'),
    ('itemName: "Camping tent"', f'itemName: "{strings["i_tent"]}"'),
    ('itemName: "Projector"', f'itemName: "{strings["i_proj"]}"'),
    ('taskDescription: "Document pickup"', f'taskDescription: "{strings["td_doc"]}"'),
    ('taskDescription: "Cake pickup"', f'taskDescription: "{strings["td_cake"]}"'),
    ('taskDescription: "IKEA desk assembly"', f'taskDescription: "{strings["td_ikea"]}"'),
    ('serviceDescription: "Short profile shoot"', f'serviceDescription: "{strings["sd_photo"]}"'),
    ('serviceDescription: "Light moving help"', f'serviceDescription: "{strings["sd_move"]}"'),
]

path = Path("src/domain/mockData.ts")
text = path.read_text(encoding="utf-8")
for old, new in pairs:
    if old not in text:
        raise SystemExit(f"missing: {old}")
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
print("ok", len(pairs))
