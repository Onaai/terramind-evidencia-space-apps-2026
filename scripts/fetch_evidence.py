#!/usr/bin/env python3
"""Reproducible NASA/ORNL native MOD13Q1 single-pixel retrieval. Python stdlib only.

Fixed site chosen before this collection; no synthetic data or interpolation.
Every HTTP response is saved byte-for-byte with URL, timestamp and SHA-256.
Default runs reuse verified caches. --offline recomputes without any network.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = 'https://modis.ornl.gov/rst/api/v1'
PRODUCT = 'MOD13Q1'
LATITUDE, LONGITUDE = -25, -63
START_YEAR, END_YEAR = 2015, 2025
GUIDE = 'https://modis-land.gsfc.nasa.gov/pdf/MOD13_User_Guide_V61.pdf'
BANDS = {
    'rawNdvi': '250m_16_days_NDVI',
    'rawEvi': '250m_16_days_EVI',
    'reliability': '250m_16_days_pixel_reliability',
    'viQuality': '250m_16_days_VI_Quality',
    'selectedDayOfYear': '250m_16_days_composite_day_of_the_year',
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(path)


class Retrievals:
    def __init__(self, data_dir, offline=False, refresh=False, timeout=120):
        self.data_dir = data_dir
        self.raw_dir = data_dir / 'raw'
        self.index_path = self.raw_dir / 'request-index.json'
        self.index = json.loads(self.index_path.read_text('utf-8')) if self.index_path.exists() else {}
        self.offline, self.refresh = offline, refresh
        self.timeout = timeout
        self.lock = threading.RLock()
        self.used = []

    def get(self, url, label, accept='application/json'):
        old = self.index.get(url)
        if old and (not self.refresh or self.offline):
            path = self.data_dir / old['path']
            raw = path.read_bytes()
            if digest(raw) != old['sha256']:
                raise ValueError(f'Cache digest mismatch: {path}')
            self.used.append(old)
            return json.loads(raw) if accept == 'application/json' else raw, old
        if self.offline:
            raise RuntimeError(f'No offline receipt for {url}')
        error = None
        for attempt in range(1, 4):
            try:
                request = urllib.request.Request(url, headers={'Accept': accept, 'User-Agent': 'TerraMind-Evidence/1.0 (NASA Space Apps research; single fixed pixel)'})
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    raw = response.read()
                    receipt = self.save(raw, url, label, response.status, dict(response.headers), response.geturl())
                parsed = json.loads(raw) if accept == 'application/json' else raw
                with self.lock:
                    self.index[url] = receipt
                    write_json(self.index_path, self.index)
                    self.used.append(receipt)
                time.sleep(0.4)
                return parsed, receipt
            except urllib.error.HTTPError as exc:
                self.save(exc.read(), url, f'{label}-attempt{attempt}-error', exc.code, dict(exc.headers), exc.geturl())
                error = exc
                if exc.code not in (429, 500, 502, 503, 504):
                    break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                error = exc
            print(f'Retrying {label}: {type(error).__name__}', flush=True)
            time.sleep(min(2 ** attempt, 8))
        raise RuntimeError(f'Failed public source {url}: {error}')

    def save(self, raw, url, label, status, headers, final_url):
        retrieved = utc_now()
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        suffix = '.json' if headers.get('Content-Type', headers.get('content-type', '')).startswith('application/json') else '.response'
        name = f'{label}-{stamp}-{digest(raw)[:12]}{suffix}'
        path = self.raw_dir / name
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        receipt = {
            'path': str(path.relative_to(self.data_dir)).replace('\\', '/'),
            'url': url, 'finalUrl': final_url, 'retrievedAt': retrieved,
            'sha256': digest(raw), 'bytes': len(raw), 'status': status,
            'contentType': headers.get('Content-Type', headers.get('content-type')),
            'etag': headers.get('ETag', headers.get('etag')),
            'lastModified': headers.get('Last-Modified', headers.get('last-modified')),
        }
        write_json(path.with_name(path.name + '.receipt.json'), receipt)
        return receipt


def url(resource, **params):
    return f'{API}/{resource}' + ('?' + urllib.parse.urlencode(params) if params else '')


def scheduled_dates():
    for year in range(START_YEAR, END_YEAR + 1):
        first = dt.date(year, 1, 1)
        next_year = dt.date(year + 1, 1, 1)
        for day in range(1, 366 if calendar.isleap(year) else 365, 16):
            date = first + dt.timedelta(days=day - 1)
            end = min(date + dt.timedelta(days=16), next_year)
            yield {'date': date.isoformat(), 'modisDate': f'A{year}{day:03d}', 'endDateExclusive': end.isoformat(), 'periodDays': (end - date).days}


def strict_reasons(point):
    reasons = []
    for field in ('rawNdvi', 'rawEvi'):
        value = point.get(field)
        if not isinstance(value, int) or isinstance(value, bool) or not -2000 <= value <= 10000:
            reasons.append(f'{field}_missing_or_out_of_range')
    if point.get('reliability') != 0:
        reasons.append('pixel_reliability_not_good')
    qa = point.get('viQuality')
    if not isinstance(qa, int) or isinstance(qa, bool) or not 0 <= qa < 65535:
        reasons.append('detailed_qa_missing')
        return reasons
    if qa & 3:
        reasons.append('modland_not_good')
    if (qa >> 2) & 15 > 2:
        reasons.append('usefulness_over_2')
    if (qa >> 6) & 3 == 3:
        reasons.append('high_aerosol')
    for bit, name in [(8, 'adjacent_cloud'), (10, 'mixed_cloud'), (14, 'snow_ice'), (15, 'shadow')]:
        if qa & (1 << bit):
            reasons.append(name)
    return reasons


def single_pixel(payload, expected_dates, receipt):
    if payload.get('nrows') != 1 or payload.get('ncols') != 1:
        raise ValueError('Source returned a different spatial scope: expected one pixel.')
    if abs(float(payload['latitude']) - LATITUDE) > 1e-8 or abs(float(payload['longitude']) - LONGITUDE) > 1e-8:
        raise ValueError('Source changed the requested location.')
    grouped = {date: {} for date in expected_dates}
    for band in payload.get('subset', []):
        date = band.get('modis_date')
        if date not in grouped:
            raise ValueError(f'Unexpected date returned: {date}')
        name = band.get('band')
        native_date = (dt.date(int(date[1:5]), 1, 1) + dt.timedelta(days=int(date[5:]) - 1)).isoformat()
        if band.get('calendar_date') is not None and band['calendar_date'] != native_date:
            raise ValueError('Native MODIS date and calendar date disagree.')
        if name in grouped[date]:
            raise ValueError(f'Duplicate native band/date: {name}/{date}')
        values = band.get('data')
        if not isinstance(values, list) or len(values) != 1:
            raise ValueError('Expected exactly one native value per band/date.')
        grouped[date][name] = band
    result = {}
    for date, bands in grouped.items():
        point = {'retrievalRef': receipt['path'], 'availability': 'returned' if bands else 'no_subset_returned'}
        for field, band_name in BANDS.items():
            native = bands.get(band_name)
            point[field] = native['data'][0] if native else None
        ndvi_record = bands.get(BANDS['rawNdvi'], {})
        metadata_identities = {(band.get('tile', band.get('title')), band.get('proc_date')) for band in bands.values()}
        if len(metadata_identities) > 1:
            raise ValueError('Bands in a composite refer to different native granules.')
        point['tile'] = ndvi_record.get('tile', ndvi_record.get('title'))
        point['processingDate'] = ndvi_record.get('proc_date')
        point['collectionVersionInResponse'] = ndvi_record.get('version')
        for variable, raw_field in [('ndvi', 'rawNdvi'), ('evi', 'rawEvi')]:
            raw = point[raw_field]
            point[variable] = round(raw * 0.0001, 4) if isinstance(raw, int) and not isinstance(raw, bool) and -2000 <= raw <= 10000 else None
        point['rejectionReasons'] = strict_reasons(point)
        point['usable'] = not point['rejectionReasons']
        result[date] = point
    return result


def self_test():
    """Local fixtures test parser invariants; they never enter the observed dataset."""
    import copy
    schedule = list(scheduled_dates())
    assert len(schedule) == 253
    assert sum(p['periodDays'] for p in schedule if p['date'].startswith('2020')) == 366
    assert sum(p['periodDays'] for p in schedule if p['date'].startswith('2021')) == 365
    assert schedule[-1]['endDateExclusive'] == '2026-01-01'
    fixture = {'nrows': 1, 'ncols': 1, 'latitude': LATITUDE, 'longitude': LONGITUDE, 'subset': []}
    values = [7324, 4951, 0, 2116, 8]
    for (field, band), value in zip(BANDS.items(), values):
        fixture['subset'].append({'modis_date': 'A2025001', 'calendar_date': '2025-01-01', 'band': band, 'data': [value], 'tile': 'h12v11', 'proc_date': '2025022075950'})
    parsed = single_pixel(fixture, ['A2025001', 'A2025017'], {'path': 'test-only'})
    assert parsed['A2025001']['ndvi'] == 0.7324
    assert parsed['A2025001']['evi'] == 0.4951
    assert parsed['A2025001']['usable'] is True
    assert parsed['A2025017']['ndvi'] is None
    assert parsed['A2025017']['availability'] == 'no_subset_returned'
    assert parsed['A2025017']['usable'] is False
    cloudy = {**parsed['A2025001'], 'viQuality': 2116 | (1 << 10)}
    assert 'mixed_cloud' in strict_reasons(cloudy)
    marginal = {**parsed['A2025001'], 'reliability': 1}
    assert 'pixel_reliability_not_good' in strict_reasons(marginal)
    fill = {**parsed['A2025001'], 'rawNdvi': -3000}
    assert 'rawNdvi_missing_or_out_of_range' in strict_reasons(fill)
    for transform in [lambda p: p.update(nrows=2), lambda p: p['subset'].append(p['subset'][0]), lambda p: p['subset'][0].update(calendar_date='2025-01-02')]:
        broken = copy.deepcopy(fixture)
        transform(broken)
        try:
            single_pixel(broken, ['A2025001'], {'path': 'test-only'})
        except ValueError:
            pass
        else:
            raise AssertionError('Parser accepted incompatible spatial/date/band metadata.')
    print('Self-test passed: schedule/leap years, native scaling, gaps, QA, duplicates, spatial and date invariants.')


def check_band_metadata(payload):
    bands = payload.get('bands', payload if isinstance(payload, list) else [])
    if not isinstance(bands, list):
        raise ValueError('Unrecognized band metadata schema.')
    named = {band.get('band', band.get('name')): band for band in bands if isinstance(band, dict)}
    for name in BANDS.values():
        if name not in named:
            raise ValueError(f'Required native band absent: {name}')
    for field in ('rawNdvi', 'rawEvi'):
        band = named[BANDS[field]]
        scale = band.get('scale_factor')
        if scale is not None and not math.isclose(float(scale), 0.0001, abs_tol=1e-12):
            raise ValueError('Service reports a different scale factor; do not continue automatically.')
    return named


def verify_collection(store, points):
    # Granule IDs include acquisition date, tile, collection, and processing ID.
    # Cross-checking the exact processing ID avoids assuming the service's collection.
    params = {'short_name': PRODUCT, 'temporal': f'{START_YEAR}-01-01T00:00:00Z,{END_YEAR}-12-31T23:59:59Z', 'point': f'{LONGITUDE},{LATITUDE}', 'page_size': 2000, 'sort_key': 'start_date'}
    cmr_url = 'https://cmr.earthdata.nasa.gov/search/granules.json?' + urllib.parse.urlencode(params)
    try:
        data, receipt = store.get(cmr_url, 'cmr-granules')
    except RuntimeError as exc:
        return {'status': 'unresolved', 'version': None, 'reason': str(exc), 'matched': 0, 'total': len(points)}
    entries = data.get('feed', {}).get('entry', [])
    identities = {}
    for entry in entries:
        for field in ('title', 'producer_granule_id'):
            identifier = entry.get(field, '')
            parts = identifier.split('.')
            if len(parts) >= 5 and parts[0] == PRODUCT:
                identities.setdefault((parts[1], parts[2], parts[4]), set()).add(parts[3])
    versions = set()
    matched = 0
    for point in points:
        match = identities.get((point['modisDate'], point.get('tile'), point.get('processingDate')), set())
        point['collectionVersionsMatchedInCMR'] = sorted(match)
        if len(match) == 1:
            point['collectionVersion'] = next(iter(match))
            versions.update(match)
            matched += 1
        else:
            point['collectionVersion'] = point.get('collectionVersionInResponse')
    status = 'verified_against_cmr_granule_ids' if matched == len(points) and len(versions) == 1 else 'partially_matched' if matched else 'unresolved'
    return {'status': status, 'version': next(iter(versions)) if status == 'verified_against_cmr_granule_ids' else None, 'matched': matched, 'total': len(points), 'versionsMatched': sorted(versions), 'cmrEntries': len(entries), 'receipt': receipt['path'], 'method': 'Exact MODIS acquisition-date + native tile + processing-ID match against NASA CMR granule IDs; not a version inferred from the current product catalog.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Recompute using SHA-256-verified cached source bytes only.')
    parser.add_argument('--refresh', action='store_true', help='Fetch new receipts, retaining every older raw response.')
    parser.add_argument('--metadata-only', action='store_true', help='Fetch only product/band/date metadata for inspection.')
    parser.add_argument('--timeout', type=float, default=120, help='Seconds per public HTTP request (default 120).')
    parser.add_argument('--self-test', action='store_true', help='Run independent in-memory parser/QA fixtures without network.')
    parser.add_argument('--workers', type=int, choices=[1, 2], default=2, help='At most two simultaneous public requests.')
    parser.add_argument('--batch-size', type=int, choices=range(1, 11), default=10, help='Native dates per request, maximum 10.')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    data_dir = ROOT / 'out' / 'data'
    store = Retrievals(data_dir, args.offline, args.refresh, args.timeout)
    products, _ = store.get(url('products'), 'products')
    if PRODUCT not in [p.get('product') for p in products.get('products', [])]:
        raise RuntimeError('MOD13Q1 is not listed by the service.')
    bands, _ = store.get(url(f'{PRODUCT}/bands'), 'bands')
    band_metadata = check_band_metadata(bands)
    dates, _ = store.get(url(f'{PRODUCT}/dates', latitude=LATITUDE, longitude=LONGITUDE), 'dates')
    available = {p['modis_date']: p for p in dates.get('dates', [])}
    expected = list(scheduled_dates())
    selected = [p for p in expected if p['modisDate'] in available]
    print(json.dumps({'expectedComposites': len(expected), 'availableListed': len(selected), 'ndviMetadata': band_metadata[BANDS['rawNdvi']]}, ensure_ascii=False), flush=True)
    if args.metadata_only:
        return
    lookup = {}
    native_grid = None
    def fetch_batch(batch):
        query = url(f'{PRODUCT}/subset', latitude=LATITUDE, longitude=LONGITUDE, startDate=batch[0]['modisDate'], endDate=batch[-1]['modisDate'], kmAboveBelow=0, kmLeftRight=0)
        payload, receipt = store.get(query, f'subset-{batch[0]["modisDate"]}-{batch[-1]["modisDate"]}')
        grid = {k: payload.get(k) for k in ('nrows', 'ncols', 'cellsize', 'xllcorner', 'yllcorner')}
        return grid, single_pixel(payload, [p['modisDate'] for p in batch], receipt)
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(fetch_batch, selected[offset:offset + args.batch_size]): selected[offset:offset + args.batch_size] for offset in range(0, len(selected), args.batch_size)}
        for future in as_completed(jobs):
            try:
                grid, received = future.result()
                if native_grid is not None and grid != native_grid:
                    raise ValueError('Native pixel grid changed across batches.')
                native_grid = grid
                lookup.update(received)
                print(f'Native composites retrieved: {len(lookup)}/{len(selected)}', flush=True)
                preview = {
                    'schemaVersion': 1, 'kind': 'observations', 'status': 'partial', 'generatedAt': utc_now(),
                    'source': {'provider': 'NASA ORNL DAAC', 'product': PRODUCT, 'collectionVersion': None},
                    'site': {'lat': LATITUDE, 'lon': LONGITUDE, 'nativeGrid': native_grid},
                    'period': {'start': f'{START_YEAR}-01-01', 'end': f'{END_YEAR}-12-31'},
                    'points': [{**p, **lookup.get(p['modisDate'], {'availability': 'no_subset_returned', 'ndvi': None, 'evi': None})} for p in expected],
                    'retrievals': list(store.used), 'warning': 'Descarga parcial para revisión local. No presentar como archivo histórico completo.'}
                write_json(data_dir / 'pilot-preview.json', preview)
            except Exception as exc:
                failures.append(str(exc))
                print(f'Batch failed, preserving raw cache: {exc}', flush=True)
    if failures:
        raise RuntimeError(f'{len(failures)} batches failed. Re-run to reuse successful requests. Only pilot-preview.json was updated.')
    points = []
    for period in expected:
        missing = {'availability': 'not_listed_by_api', 'ndvi': None, 'evi': None, **{k: None for k in BANDS}, 'usable': False, 'rejectionReasons': ['not_listed_by_api'], 'tile': None, 'processingDate': None, 'retrievalRef': None}
        points.append({**period, **lookup.get(period['modisDate'], missing)})
    collection = verify_collection(store, points)
    dataset = {
        'schemaVersion': 1, 'kind': 'observations', 'frequency': '16-day-composite', 'generatedAt': utc_now(),
        'source': {'provider': 'NASA LP DAAC / ORNL DAAC TESViS', 'product': PRODUCT, 'collectionVersion': collection['version'], 'collectionVerification': collection, 'api': API, 'productDocumentation': GUIDE, 'serviceDocumentation': 'https://modis.ornl.gov/data/modis_webservice.html', 'serviceCitation': 'https://doi.org/10.3334/ORNLDAAC/1600', 'scaleFactor': 0.0001, 'units': 'dimensionless', 'dataStatus': 'real_satellite_composites_not_simulated'},
        'site': {'id': 'chaco-seco-pilot', 'name': 'Sitio piloto del Chaco seco', 'lat': LATITUDE, 'lon': LONGITUDE, 'nominalResolution': 250, 'scope': 'single-native-pixel', 'scopeWarning': 'Un píxel nativo que contiene el punto consultado. No es un promedio del Gran Chaco, ni de una ventana de 1° × 1°.', 'nativeGrid': native_grid, 'locationSelection': 'Coordenadas fijadas antes de recolectar o evaluar la serie; no elegidas por el resultado.'},
        'period': {'start': f'{START_YEAR}-01-01', 'end': f'{END_YEAR}-12-31', 'expectedComposites': len(expected), 'availableComposites': sum(p['availability'] == 'returned' for p in points)},
        'qualityPolicy': {'name': 'strict-v1', 'reliability': [0], 'modland': [0], 'maxUsefulness': 2, 'excludedAerosol': [3], 'clearBits': [8, 10, 14, 15], 'validRawRange': [-2000, 10000], 'bothIndicesRequiredForPrecomputedUsable': True, 'reference': GUIDE, 'warning': 'Good QA is a screening criterion, not a proof of absence of measurement error. Downstream variable-specific policies may recalculate usability from the original flags.'},
        'dateSemantics': 'date starts a native 16-day compositing window; final annual window is truncated at January 1. selectedDayOfYear is the actual day chosen by the native pixel compositor. periodDays are represented days, not independent daily observations.',
        'points': points, 'retrievals': store.used,
    }
    write_json(data_dir / 'pilot.json', dataset)
    write_json(data_dir / 'manifest.json', {'generatedAt': dataset['generatedAt'], 'dataset': 'pilot.json', 'datasetSha256': digest((data_dir / 'pilot.json').read_bytes()), 'retrievals': store.used, 'collectionVerification': collection})
    print(json.dumps({'file': str(data_dir / 'pilot.json'), 'points': len(points), 'strictUsableBothIndices': sum(p['usable'] for p in points), 'collectionVerification': collection}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
