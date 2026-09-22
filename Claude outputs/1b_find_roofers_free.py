"""
FREE version of step 1: finds roofers in the San Antonio area from OpenStreetMap (no API key, no card).
Output: roofers_raw.csv (same format as the Google version, so 2_enrich_websites.py works unchanged).
Run: py 1b_find_roofers_free.py
Note: OpenStreetMap coverage of small businesses is patchy, so expect a smaller list than Google.
Data (c) OpenStreetMap contributors, ODbL license.
"""
import csv, requests

# South-west, north-east corners covering San Antonio + surrounding suburbs
BBOX = "29.10,-98.95,29.85,-98.15"
QUERY = f"""
[out:json][timeout:90];
(
  nwr["craft"~"roofer|roofing",i]({BBOX});
  nwr["shop"~"roofing",i]({BBOX});
  nwr["office"~"roofing",i]({BBOX});
  nwr["name"~"roof",i]["craft"]({BBOX});
  nwr["name"~"roof(ing|er)",i]["phone"]({BBOX});
  nwr["name"~"roof(ing|er)",i]["website"]({BBOX});
);
out center tags;
"""
r = requests.post("https://overpass-api.de/api/interpreter", data={"data": QUERY},
                  headers={"User-Agent": "AdaptifyResearch/1.0"}, timeout=120)
r.raise_for_status()
seen, rows = set(), []
for el in r.json().get("elements", []):
    t = el.get("tags", {})
    name = t.get("name", "").strip()
    if not name or name.lower() in seen:
        continue
    seen.add(name.lower())
    addr = " ".join(filter(None, [t.get("addr:housenumber"), t.get("addr:street")]))
    city = ", ".join(filter(None, [t.get("addr:city"), t.get("addr:state"), t.get("addr:postcode")]))
    rows.append({
        "name": name,
        "address": ", ".join(filter(None, [addr, city])),
        "phone": t.get("phone") or t.get("contact:phone", ""),
        "website": t.get("website") or t.get("contact:website", ""),
        "rating": "", "reviews": "",
        "maps_url": f"https://www.openstreetmap.org/{el['type']}/{el['id']}",
    })
with open("roofers_raw.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["name", "address", "phone", "website", "rating", "reviews", "maps_url"])
    w.writeheader(); w.writerows(rows)
print(f"Saved {len(rows)} businesses to roofers_raw.csv ({sum(1 for x in rows if x['website'])} with a website)")
