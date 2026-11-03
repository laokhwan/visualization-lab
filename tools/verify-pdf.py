"""Optional local PDF QA: pip install pymupdf. No network or app backend."""
import sys
from pathlib import Path

local_packages = Path(__file__).resolve().parent.parent / '.test-python'
if local_packages.exists():
    sys.path.insert(0, str(local_packages))
import fitz

pdf_paths = sys.argv[1:] or ['artifacts/sample-report.pdf']
for filename in pdf_paths:
    doc = fitz.open(filename)
    target = Path(filename).with_suffix('')
    target.mkdir(parents=True, exist_ok=True)
    for index, page in enumerate(doc):
        text = page.get_text()
        assert 'เบราว์เซอร์' in text, f'Missing integrity warning: {filename}, page {index + 1}'
        assert '\ufffd' not in text, f'Missing Unicode glyph: {filename}, page {index + 1}'
        for block in page.get_text('dict')['blocks']:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    assert x0 >= -1 and y0 >= -1 and x1 <= page.rect.width + 1 and y1 <= page.rect.height + 1, f'Clipped text: {filename}, page {index + 1}'
        page.get_pixmap().save(str(target / f'page-{index + 1}.png'))
    print(f'Checked and rendered {len(doc)} pages: {filename}')
