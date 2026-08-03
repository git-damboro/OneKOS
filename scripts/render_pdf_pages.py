from pathlib import Path
import sys

import pypdfium2 as pdfium


source = Path(sys.argv[1]).resolve()
output_dir = Path(sys.argv[2]).resolve()
output_dir.mkdir(parents=True, exist_ok=True)

pdf = pdfium.PdfDocument(source)
for index, page in enumerate(pdf):
    bitmap = page.render(scale=1.6)
    image = bitmap.to_pil()
    image.save(output_dir / f"page-{index + 1:02d}.png")

print(f"rendered={len(pdf)}")
