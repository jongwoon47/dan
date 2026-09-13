from pathlib import Path
import re

p = Path("src/domain/mockData.ts")
t = p.read_text(encoding="utf-8")
t2 = re.sub(r"(\$\{productName\}) .\s*(\$\{Math)", r"\1 | \2", t)
p.write_text(t2, encoding="utf-8")
print("ok", "${productName} | ${Math" in t2)
