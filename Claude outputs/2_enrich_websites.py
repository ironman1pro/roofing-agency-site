"""
Step 2: Visit each roofer's public website, find a contact email, and score how weak the site is.
Input:  roofers_raw.csv    Output: roofers_leads.csv (sorted, weakest websites first)
Run:    pip install requests beautifulsoup4   then   python 2_enrich_websites.py
Only reads public pages, one request per page, with a delay. Respects robots.txt.
"""
import csv, re, time, urllib.robotparser
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (compatible; AdaptifyResearch/1.0; +https://adaptify.tech)"
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
JUNK = ("sentry", "wixpress", "example.", "domain.com", "email.com", "yourname", ".png", ".jpg", ".webp")

def allowed(url):
    try:
        p = urlparse(url); rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{p.scheme}://{p.netloc}/robots.txt"); rp.read()
        return rp.can_fetch(UA, url)
    except Exception:
        return True

def get(url):
    if not allowed(url): return None
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=15)
        return r if r.ok and "text/html" in r.headers.get("content-type", "") else None
    except Exception:
        return None

def emails_from(html):
    found = set(m.lower() for m in EMAIL.findall(html))
    return [e for e in found if not any(j in e for j in JUNK)]

def analyze(row):
    url = row["website"]; out = {"email": "", "site_score": "", "site_notes": ""}
    if not url:
        out.update(site_score=10, site_notes="No website"); return out
    r = get(url)
    if r is None:
        out.update(site_score=9, site_notes="Site unreachable or blocks bots"); return out
    html = r.text; soup = BeautifulSoup(html, "html.parser"); score, notes = 0, []
    if not r.url.startswith("https"): score += 2; notes.append("No HTTPS")
    if not soup.find("meta", attrs={"name": "viewport"}): score += 3; notes.append("Not mobile-ready")
    if not soup.find("a", href=re.compile(r"^tel:")): score += 1; notes.append("No tap-to-call")
    if not re.search(r"estimate|quote", html, re.I): score += 1; notes.append("No estimate CTA")
    if not soup.find("script", type="application/ld+json"): score += 1; notes.append("No structured data")
    yrs = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:20\d\d\s*[-–]\s*)?(20\d\d|19\d\d)", html, re.I)]
    if yrs and max(yrs) <= 2021: score += 2; notes.append(f"Copyright {max(yrs)}")
    if re.search(r"wix\.com|godaddy|weebly|squarespace", html, re.I): notes.append("Template builder")
    mails = emails_from(html)
    if not mails:
        for a in soup.find_all("a", href=True):
            if re.search(r"contact|about", a["href"], re.I):
                time.sleep(1); rc = get(urljoin(r.url, a["href"]))
                if rc: mails = emails_from(rc.text)
                if mails: break
    out.update(email=mails[0] if mails else "", site_score=score, site_notes="; ".join(notes))
    return out

rows = list(csv.DictReader(open("roofers_raw.csv", encoding="utf-8")))
result = []
for i, row in enumerate(rows, 1):
    print(f"[{i}/{len(rows)}] {row['name']}")
    row.update(analyze(row)); result.append(row); time.sleep(1)
result.sort(key=lambda r: -int(r["site_score"] or 0))
with open("roofers_leads.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(result[0].keys())); w.writeheader(); w.writerows(result)
print("Saved roofers_leads.csv (highest site_score = weakest website = best prospect)")
