from pathlib import Path
import json
import subprocess
from urllib.parse import quote

BASE = Path(__file__).resolve().parent
OUTPUT = BASE.parent / "index.html"
data = json.loads((BASE / "collection.json").read_text())
locations = json.loads((BASE / "locations.json").read_text())
subprocess.run(["node", "-e", "const fs=require('node:fs');require(process.argv[1]).validateLayout(JSON.parse(fs.readFileSync(process.argv[2])),JSON.parse(fs.readFileSync(process.argv[3])).pieces)",
                str(BASE / "navigation-model.cjs"), str(BASE / "locations.json"), str(BASE / "collection.json")], check=True)
bundler = BASE.parent / "node_modules/esbuild/lib/main.js"
if not bundler.exists():
    raise SystemExit("Build dependencies are missing. Run npm ci in the project folder first.")
bundle = BASE / "generated/navigation.bundle.js"
bundle.parent.mkdir(exist_ok=True)
subprocess.run(["node", str(BASE / "build_navigation.cjs")], check=True)
override_path = BASE / "highres" / "replacements.json"
replacements = json.loads(override_path.read_text()) if override_path.exists() else {}
piece_ids = {p["id"] for p in data["pieces"]}
assert set(replacements) <= piece_ids
for piece in data["pieces"]:
    if piece["id"] in replacements:
        replacement = replacements[piece["id"]]
        assert replacement["imageWidth"] >= 192 and replacement["imageHeight"] >= 192
        assert replacement["imageDataUrl"].startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"))
        for key in ("imageDataUrl", "imageWidth", "imageHeight"):
            piece[key] = replacement[key]
        piece["imageSource"] = replacement["sourceUrl"]
assert len(data["pieces"]) == 56
assert len({p["id"] for p in data["pieces"]}) == 56
assert all(p["imageDataUrl"].startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")) for p in data["pieces"])
html = (BASE / "page.html").read_text()
parts = {
    "FAVICON": "data:image/svg+xml," + quote((BASE.parent / "favicon.svg").read_text(), safe=""),
    "STYLES": "\n".join((BASE / name).read_text() for name in ["style.css", "navigation.css", "picture-browser.css"]),
    "DATA": json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
    "LOCATIONS": json.dumps(locations, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
    "ENGINE": (BASE / "engine.js").read_text(),
    "CATEGORIES": (BASE / "category-model.js").read_text(),
    "NAVIGATION": "/* Three.js license: " + (BASE.parent / "node_modules/three/LICENSE").read_text() + " */\n" + bundle.read_text(),
    "APP": (BASE / "app.js").read_text(),
}
for key, value in parts.items():
    marker = "/*__" + key + "__*/"
    assert html.count(marker) == 1
    assert "</script" not in value.lower()
    html = html.replace(marker, value)
assert "/*__" not in html
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(html, encoding="utf-8")
print(json.dumps({"file": str(OUTPUT), "bytes": OUTPUT.stat().st_size, "pieces": len(data["pieces"]), "images": len(data["pieces"]), "higher_resolution_images": len(replacements)}))
