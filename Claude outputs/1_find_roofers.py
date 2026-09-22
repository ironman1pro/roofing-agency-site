"""
Step 1: Find roofing companies in San Antonio using the official Google Places API.
Output: roofers_raw.csv  (name, address, phone, website, rating, review count, maps link)

Setup (one time):
  1. Google Cloud console -> create a project -> enable "Places API (New)".
  2. Create an API key and restrict it to that API.
  3. Set the key in your terminal (do NOT paste it into chat or commit it):
       Windows CMD:   set GOOGLE_PLACES_KEY=your_key_here
  4. pip install requests
Run:  python 1_find_roofers.py
"""
import os, csv, sys, time, requests

KEY = os.environ.get("GOOGLE_PLACES_KEY")
if not KEY:
    sys.exit("Set GOOGLE_PLACES_KEY first (see the top of this file).")

URL = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress",
    "places.nationalPhoneNumber", "places.websiteUri", "places.rating",
    "places.userRatingCount", "places.googleMapsUri", "places.businessStatus",
    "nextPageToken",
])
# Each query returns at most 60 results, so we vary the query by area.
AREAS = ["San Antonio", "Northwest San Antonio", "North San Antonio", "Stone Oak San Antonio",
         "Alamo Heights", "Southwest San Antonio", "Southeast San Antonio", "Universal City",
         "Schertz", "New Braunfels", "Boerne", "Helotes", "Live Oak TX", "Converse TX"]
TERMS = ["roofing contractor", "roof repair", "roof replacement"]

seen, rows = set(), []
for area in AREAS:
    for term in TERMS:
        token = None
        for _ in range(3):  # up to 3 pages of 20
            body = {"textQuery": f"{term} in {area}, TX", "pageSize": 20}
            if token:
                body["pageToken"] = token
            r = requests.post(URL, json=body, headers={
                "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS}, timeout=30)
            if r.status_code != 200:
                print("API error", r.status_code, r.text[:200]); break
            data = r.json()
            for p in data.get("places", []):
                if p["id"] in seen or p.get("businessStatus") not in (None, "OPERATIONAL"):
                    continue
                seen.add(p["id"])
                rows.append({
                    "name": p.get("displayName", {}).get("text", ""),
                    "address": p.get("formattedAddress", ""),
                    "phone": p.get("nationalPhoneNumber", ""),
                    "website": p.get("websiteUri", ""),
                    "rating": p.get("rating", ""),
                    "reviews": p.get("userRatingCount", ""),
                    "maps_url": p.get("googleMapsUri", ""),
                })
            token = data.get("nextPageToken")
            if not token:
                break
            time.sleep(1.5)

with open("roofers_raw.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["name", "address", "phone", "website", "rating", "reviews", "maps_url"])
    w.writeheader(); w.writerows(rows)
print(f"Saved {len(rows)} businesses to roofers_raw.csv "
      f"({sum(1 for r in rows if r['website'])} with a website)")
