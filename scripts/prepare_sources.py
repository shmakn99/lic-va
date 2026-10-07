"""One-time local PDF download/extraction utility, not an ingestion service."""
import concurrent.futures
import pathlib
import urllib.request
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = {
    'new-jeevan-anand': "https://licindia.in/documents/20121/1319704/LIC%27s%2BNew%2BJeevan%2BAnand%2BSales%2BBrochure%2BEng_141025.pdf/43b60cd9-f6f1-c889-734c-47c565a47ada?t=1760418918360",
    'digi-term': 'https://licindia.in/documents/20121/1319704/Digi%2BTerm%2B-%2BSales%2BBrochure_April%2B25.pdf/31117c26-5e06-2f66-3c21-d92610e51051?t=1744863655602',
    'jeevan-utsav-single-premium': 'https://www.licindia.in/documents/20121/1639835/LIC_Jeevan%2BUtsav%2B%2BSingle%2BPremium_Sales%2BBrochure_English.pdf/4f48bd54-fab2-1b97-cc38-fb19dc663399?t=1768116819230',
}

def extract(item):
    name, url = item
    folder = ROOT / '.local' / 'sources'
    folder.mkdir(parents=True, exist_ok=True)
    pdf = folder / (name + '.pdf')
    if not pdf.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        pdf.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    reader = PdfReader(pdf)
    text = '\n\n'.join(f'=== PDF PAGE {i+1} ===\n' + p.extract_text(extraction_mode='layout') for i, p in enumerate(reader.pages))
    (folder / (name + '.txt')).write_text(text, encoding='utf-8')
    return f'{name}: {len(reader.pages)} pages extracted'

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(extract, DOCS.items()):
            print(result)
