#!/usr/bin/env python3
"""NASA POWER / GPM IMERG daily point series, with original-byte provenance.

Python standard library only. Default: verify/reuse cache, otherwise fetch once.
--offline never uses the network. --seed-from imports the already verified research
cache without another request. No simulations, imputation, or source substitution.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'out' / 'data'
RAW_NAME = 'imerg-daily-2015-2025.raw.json'
PARAMETER = 'IMERG_PRECTOT'
START, END = dt.date(2015, 1, 1), dt.date(2025, 12, 31)
LATITUDE, LONGITUDE = -25, -63
REQUEST_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + urllib.parse.urlencode({
    'parameters': PARAMETER, 'community': 'AG', 'longitude': LONGITUDE,
    'latitude': LATITUDE, 'format': 'JSON', 'start': START.strftime('%Y%m%d'),
    'end': END.strftime('%Y%m%d'), 'time-standard': 'UTC',
})
DOCUMENTATION = 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/#imerg'


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    temp.replace(path)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key in source: {key}')
        result[key] = value
    return result


def read_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def expected_days():
    date = START
    while date <= END:
        yield date
        date += dt.timedelta(days=1)


def validate_receipt(raw, receipt):
    if sha256(raw) != receipt.get('sha256'):
        raise ValueError('Raw source SHA-256 does not match its receipt.')
    if receipt.get('status') != 200:
        raise ValueError('The precipitation source receipt must document HTTP 200.')
    if receipt.get('url') != REQUEST_URL:
        raise ValueError('The cached request does not match the fixed source/site/period.')
    if not receipt.get('retrievedAt'):
        raise ValueError('The source receipt must preserve its original retrieval timestamp.')


def normalize(payload):
    header = payload.get('header', {})
    if header.get('sources') != ['IMERG']:
        raise ValueError('Source is not exclusively IMERG; do not substitute a reanalysis.')
    if header.get('time_standard') != 'UTC':
        raise ValueError('IMERG daily integration requires the documented UTC time standard.')
    if header.get('start') != START.strftime('%Y%m%d') or header.get('end') != END.strftime('%Y%m%d'):
        raise ValueError('Response header does not match the requested period.')
    metadata = payload.get('parameters', {}).get(PARAMETER, {})
    if metadata.get('units') != 'mm/day':
        raise ValueError('Unexpected source units; do not silently apply the old integration rule.')
    geometry = payload.get('geometry', {})
    coordinates = geometry.get('coordinates', [])
    if geometry.get('type') != 'Point' or len(coordinates) < 2 or coordinates[:2] != [LONGITUDE, LATITUDE]:
        raise ValueError('Response coordinates differ from the fixed pilot query.')
    values = payload.get('properties', {}).get('parameter', {}).get(PARAMETER)
    if not isinstance(values, dict):
        raise ValueError('The response does not contain the requested daily series.')
    expected = list(expected_days())
    keys = {date.strftime('%Y%m%d') for date in expected}
    if set(values) - keys:
        raise ValueError('Unexpected dates in daily series; refusing to fold annual or other records into days.')
    fill = header.get('fill_value')
    points, missing, invalid = [], [], []
    for date in expected:
        key = date.strftime('%Y%m%d')
        raw = values.get(key)
        usable = isinstance(raw, (int, float)) and not isinstance(raw, bool) and math.isfinite(raw) and raw != fill and raw >= 0
        points.append({'date': date.isoformat(), 'precip': raw if usable else None})
        if key not in values:
            missing.append(date.isoformat())
        elif not usable:
            invalid.append(date.isoformat())
    return points, {'expectedDays': len(expected), 'returnedDateKeys': len(values), 'availableDays': sum(p['precip'] is not None for p in points), 'missingDates': missing, 'invalidOrFillDates': invalid}


def load_source(args):
    raw_dir = DATA / 'power-raw'
    raw_path, receipt_path = raw_dir / RAW_NAME, raw_dir / 'receipt.json'
    if args.seed_from:
        source_dir = Path(args.seed_from)
        raw = (source_dir / 'nasa-power-imerg-daily-2015-2025.raw.json').read_bytes()
        receipt = read_json((source_dir / 'imerg-receipt.json').read_bytes())
        validate_receipt(raw, receipt)
        print('Using verified research cache; no network request.', flush=True)
    elif raw_path.exists() and receipt_path.exists() and not args.refresh:
        raw, receipt = raw_path.read_bytes(), read_json(receipt_path.read_bytes())
        validate_receipt(raw, receipt)
        print('Using SHA-256-verified project cache; no network request.', flush=True)
        return raw, receipt
    else:
        if args.offline:
            raise RuntimeError('Offline mode requires the original response and its receipt.')
        request = urllib.request.Request(REQUEST_URL, headers={'Accept': 'application/json', 'User-Agent': 'TerraMind-Evidence/1.0 (fixed-pilot research)'})
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            raw = response.read()
            receipt = {'url': REQUEST_URL, 'finalUrl': response.geturl(), 'status': response.status, 'retrievedAt': now(), 'sha256': sha256(raw), 'bytes': len(raw)}
        validate_receipt(raw, receipt)
        print('Fetched NASA POWER / IMERG source once.', flush=True)
    # Validate scientific identity before accepting a new cache as the canonical source.
    normalize(read_json(raw))
    raw_dir.mkdir(parents=True, exist_ok=True)
    if raw_path.exists() and sha256(raw_path.read_bytes()) != sha256(raw):
        previous_raw = raw_path.read_bytes()
        archive = raw_dir / ('archived-' + sha256(previous_raw) + '.raw.json')
        archive.write_bytes(previous_raw)
        if receipt_path.exists():
            archive.with_name(archive.name + '.receipt.json').write_bytes(receipt_path.read_bytes())
    raw_path.write_bytes(raw)
    receipt = {**receipt, 'path': 'power-raw/' + RAW_NAME}
    write_json(receipt_path, receipt)
    return raw, receipt


def self_test():
    import copy
    days = list(expected_days())
    assert len(days) == 4018
    assert dt.date(2016, 2, 29) in days and dt.date(2024, 2, 29) in days
    fixture = {'header': {'sources': ['IMERG'], 'time_standard': 'UTC', 'start': '20150101', 'end': '20251231', 'fill_value': -999}, 'parameters': {PARAMETER: {'units': 'mm/day'}}, 'geometry': {'type': 'Point', 'coordinates': [-63, -25]}, 'properties': {'parameter': {PARAMETER: {'20150101': 12.5, '20150102': 0, '20150103': -999, '20150104': -0.1}}}}
    points, quality = normalize(fixture)
    assert len(points) == 4018
    assert [p['precip'] for p in points[:5]] == [12.5, 0, None, None, None]
    assert quality['availableDays'] == 2
    assert quality['invalidOrFillDates'] == ['2015-01-03', '2015-01-04']
    for mutation in [lambda p: p['header'].update(sources=['MERRA2']), lambda p: p['header'].update(time_standard='LST'), lambda p: p['parameters'][PARAMETER].update(units='mm/month'), lambda p: p['geometry'].update(coordinates=[-62, -25]), lambda p: p['properties']['parameter'][PARAMETER].update({'201513': 10})]:
        bad = copy.deepcopy(fixture)
        mutation(bad)
        try:
            normalize(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('Accepted incompatible source, scope, units, time or dates.')
    try:
        read_json(b'{"20150101": 1, "20150101": 2}')
    except ValueError:
        pass
    else:
        raise AssertionError('Duplicate dates were accepted.')
    try:
        validate_receipt(b'changed bytes', {'sha256': sha256(b'original'), 'status': 200, 'url': REQUEST_URL, 'retrievedAt': now()})
    except ValueError:
        pass
    else:
        raise AssertionError('Modified source bytes were accepted.')
    print('Precipitation ingestion tests passed: dates/leap days, source/scope/units, zero-vs-fill, missing dates, duplicate keys, SHA-256.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--refresh', action='store_true', help='Fetch a new response, archiving changed original source bytes.')
    parser.add_argument('--seed-from', help='Directory containing the verified research response and imerg-receipt.json.')
    parser.add_argument('--timeout', type=float, default=90)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.offline and args.refresh:
        raise ValueError('--offline and --refresh cannot be combined.')
    raw, receipt = load_source(args)
    payload = read_json(raw)
    points, quality = normalize(payload)
    dataset = {
        'schemaVersion': 1, 'kind': 'observations', 'observationType': 'satellite-derived precipitation estimates', 'frequency': 'daily', 'status': 'complete', 'generatedAt': now(),
        'source': {
            'product': PARAMETER, 'provider': 'NASA POWER / GPM IMERG', 'collectionVersion': None, 'run': None,
            'units': 'mm/day', 'timeStandard': 'UTC', 'apiVersion': payload['header'].get('api', {}).get('version'),
            'sourceNamesInResponse': payload['header']['sources'], 'fillValue': payload['header'].get('fill_value'),
            'url': REQUEST_URL, 'documentation': DOCUMENTATION,
            'apiDocumentation': 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
            'collectionVerification': 'The response identifies IMERG but does not disclose the collection or processing run. No version/Final/Late claim is inferred.',
            'retrievalQualityFlagsAvailable': False,
            'qualityNote': 'Date availability is temporal completeness, not retrieval quality. The documented IMERG_PRECRETRIEVALS query was rejected by the API; no counts or detailed flags are invented.',
            'integration': 'Integrate each reported daily mm/day value over one UTC day. Monthly/annual totals are sums over complete calendars, without scaling or imputation for missing days.',
        },
        'site': {'id': 'chaco-precipitation-pilot', 'name': 'Consulta piloto del Chaco seco', 'lat': LATITUDE, 'lon': LONGITUDE, 'resolutionDegrees': 0.1, 'scope': 'single-grid-cell', 'scopeWarning': 'Query-associated IMERG grid cell at documented nominal 0.1-degree resolution. The response echoes query coordinates; exact native cell center/bounds are not disclosed. This is not a 250-m MODIS pixel or a Gran Chaco regional average.'},
        'period': {'start': START.isoformat(), 'end': END.isoformat()},
        'quality': quality, 'points': points, 'retrievals': [receipt],
    }
    write_json(DATA / 'precipitation.json', dataset)
    write_json(DATA / 'precipitation-manifest.json', {'generatedAt': dataset['generatedAt'], 'dataset': 'precipitation.json', 'datasetSha256': sha256((DATA / 'precipitation.json').read_bytes()), 'sourceSha256': sha256(raw), 'retrievals': [receipt], 'expectedDays': quality['expectedDays'], 'availableDays': quality['availableDays']})
    print(json.dumps({'path': str(DATA / 'precipitation.json'), **quality, 'sourceSha256': sha256(raw)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
