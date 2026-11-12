#!/usr/bin/env python3
"""Verify public NASA CMR metadata. Never downloads or fabricates observations.

Python 3.10+, standard library only. No Earthdata password/token is needed.
CMR results are discovery metadata; granule counts are NOT environmental values.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://cmr.earthdata.nasa.gov/search/"
AREAS = {
    "seco": {"label": "Chaco seco · ventana exploratoria", "bbox": [-63.5, -25.5, -62.5, -24.5]},
    "transicion": {"label": "Transición · ventana exploratoria", "bbox": [-61.5, -26.5, -60.5, -25.5]},
    "humedo": {"label": "Chaco húmedo · ventana exploratoria", "bbox": [-59.5, -26.5, -58.5, -25.5]},
}
PRODUCTS = {
    "vegetation": {"short_name": "MOD13A2", "version": "061", "variables": ["ndvi", "evi"], "documentation": "https://doi.org/10.5067/MODIS/MOD13A2.061"},
    "precipitation": {"short_name": "GPM_3IMERGM", "version": "07", "variables": ["precip"], "documentation": "https://gpm.nasa.gov/data/imerg"},
    "soil_moisture": {"short_name": "SPL3SMP", "version": "009", "variables": ["soil"], "documentation": "https://nsidc.org/data/spl3smp/versions/9"},
    "active_fire": {"short_name": "VNP14IMG", "version": "002", "variables": ["hotspots"], "documentation": "https://www.earthdata.nasa.gov/data/tools/firms"},
    "burned_area": {"short_name": "MCD64A1", "version": "061", "variables": ["burned_area"], "documentation": "https://doi.org/10.5067/MODIS/MCD64A1.061"},
}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def request_metadata(endpoint, parameters, cache_directory, timeout):
    url = BASE + endpoint + ".json?" + urllib.parse.urlencode(parameters)
    req = urllib.request.Request(url, headers={"Accept": "application/json", "Client-Id": "terramind-mvp-catalog", "User-Agent": "TerraMind-MVP/1.0 (catalog discovery only)"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read()
        metadata = {
            "url": url,
            "httpStatus": response.status,
            "retrievedAt": utc_now(),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "cmrHits": int(response.headers["CMR-Hits"]) if response.headers.get("CMR-Hits") else None,
        }
    payload = json.loads(raw)
    if not isinstance(payload.get("feed", {}).get("entry"), list):
        raise ValueError("CMR returned an unexpected metadata structure")
    cache_directory.mkdir(parents=True, exist_ok=True)
    filename = hashlib.sha256(url.encode()).hexdigest()[:20] + ".json"
    (cache_directory / filename).write_bytes(raw)
    metadata["rawResponseFile"] = "catalog-cache/" + filename
    return payload["feed"]["entry"], metadata


def selected_fields(entry):
    return {key: entry[key] for key in ("id", "title", "short_name", "version_id", "time_start", "time_end", "data_center", "granule_size") if key in entry}


def run(args):
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    if start > end:
        raise ValueError("--start must be on or before --end")
    if args.sample_size < 1 or args.sample_size > 10:
        raise ValueError("--sample-size must be between 1 and 10; this is a catalog preview")
    output = args.output.resolve()
    report = {
        "schemaVersion": 1,
        "kind": "nasa-cmr-catalog-metadata",
        "status": "pending",
        "observationsIncluded": False,
        "timeSeriesIncluded": False,
        "generatedAt": utc_now(),
        "scope": "Public NASA CMR catalog verification; environmental series remain in demo mode.",
        "areaDisclaimer": "Rectangular exploratory AOIs in Argentina; not official ecoregion boundaries or an exhaustive Gran Chaco mask.",
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "areas": AREAS,
        "products": [],
        "errors": [],
    }
    for key, product in PRODUCTS.items():
        record = {"key": key, **product, "status": "pending", "samples": []}
        report["products"].append(record)
        try:
            entries, response = request_metadata("collections", {"short_name": product["short_name"], "version": product["version"], "page_size": 10}, output.parent / "catalog-cache", args.timeout)
            record["collectionRequest"] = response
            if len(entries) != 1:
                record["candidates"] = [selected_fields(entry) for entry in entries]
                raise ValueError(f"Expected one unambiguous collection, got {len(entries)}; inspect candidates")
            collection = entries[0]
            record["collection"] = selected_fields(collection)
            for area_id, area in AREAS.items():
                granules, query = request_metadata("granules", {
                    "collection_concept_id": collection["id"],
                    "bounding_box": ",".join(map(str, area["bbox"])),
                    "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z",
                    "page_size": args.sample_size,
                    "sort_key": "start_date",
                }, output.parent / "catalog-cache", args.timeout)
                record["samples"].append({"area": area_id, "query": query, "returnedGranules": [selected_fields(granule) for granule in granules], "sampleOnly": True})
            record["status"] = "verified_catalog"
            print(f"{product['short_name']} {product['version']}: verified catalog; no observations downloaded")
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            record["status"] = "error"
            record["error"] = str(exc)
            report["errors"].append({"product": key, "message": str(exc)})
            print(f"{product['short_name']}: catalog unavailable ({exc})", file=sys.stderr)
    report["status"] = "verified_catalog" if not report["errors"] else "partial_or_unavailable"
    report["completedAt"] = utc_now()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f"Metadata manifest: {output}")
    return 1 if report["errors"] else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="2015-01-01", help="ISO date, inclusive")
    parser.add_argument("--end", default="2025-12-31", help="ISO date, inclusive")
    parser.add_argument("--sample-size", type=int, default=1, help="Granule metadata examples per area, NOT scientific samples")
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "dist" / "data" / "nasa-catalog.json")
    args = parser.parse_args()
    try:
        return run(args)
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    sys.exit(main())
