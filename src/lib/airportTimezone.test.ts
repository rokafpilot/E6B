import { describe, it, expect } from 'vitest';
import { getAirportTimeZone, getAirportLocalObservedTime } from './airportTimezone';

describe('airportTimezone tests', () => {
  it('correctly maps airport ICAO to IANA timezone', () => {
    // 한국 / 일본
    expect(getAirportTimeZone('RKSI')).toBe('Asia/Seoul');
    expect(getAirportTimeZone('RKSS')).toBe('Asia/Seoul');
    expect(getAirportTimeZone('RJTT')).toBe('Asia/Tokyo');
    expect(getAirportTimeZone('RJAA')).toBe('Asia/Tokyo');

    // 미국 주요 공항 (다양한 시간대)
    expect(getAirportTimeZone('KJFK')).toBe('America/New_York');
    expect(getAirportTimeZone('KBOS')).toBe('America/New_York');
    expect(getAirportTimeZone('KORD')).toBe('America/Chicago');
    expect(getAirportTimeZone('KDFW')).toBe('America/Chicago');
    expect(getAirportTimeZone('KDEN')).toBe('America/Denver');
    expect(getAirportTimeZone('KPHX')).toBe('America/Phoenix');
    expect(getAirportTimeZone('KLAX')).toBe('America/Los_Angeles');
    expect(getAirportTimeZone('KSFO')).toBe('America/Los_Angeles');
    expect(getAirportTimeZone('PANC')).toBe('America/Anchorage');
    expect(getAirportTimeZone('PHNL')).toBe('Pacific/Honolulu');

    // 유럽
    expect(getAirportTimeZone('EGLL')).toBe('Europe/London');
    expect(getAirportTimeZone('LFPG')).toBe('Europe/Paris');
    expect(getAirportTimeZone('EDDF')).toBe('Europe/Berlin');

    // 아시아 / 중동 / 오세아니아
    expect(getAirportTimeZone('VHHH')).toBe('Asia/Hong_Kong');
    expect(getAirportTimeZone('WSSS')).toBe('Asia/Singapore');
    expect(getAirportTimeZone('VTBS')).toBe('Asia/Bangkok');
    expect(getAirportTimeZone('OMDB')).toBe('Asia/Dubai');
    expect(getAirportTimeZone('YSSY')).toBe('Australia/Sydney');
  });

  it('correctly formats local observed time with airport timezone', () => {
    // 2026-09-20 12:00:00 UTC
    const fixedUtcTimeSec = Math.floor(Date.UTC(2026, 8, 20, 12, 0, 0) / 1000);

    // RKSI (Seoul): UTC+9 -> 21:00 KST
    const rksi = getAirportLocalObservedTime('RKSI', fixedUtcTimeSec);
    expect(rksi.localTimeStr).toBe('21:00');
    expect(rksi.tzAbbr).toBe('KST');
    expect(rksi.fullStr).toBe('21:00 KST');

    // KJFK (New York, EDT summer): UTC-4 -> 08:00 EDT
    const kjfk = getAirportLocalObservedTime('KJFK', fixedUtcTimeSec);
    expect(kjfk.localTimeStr).toBe('08:00');
    expect(kjfk.tzAbbr).toBe('EDT');
    expect(kjfk.fullStr).toBe('08:00 EDT');

    // KLAX (Los Angeles, PDT summer): UTC-7 -> 05:00 PDT
    const klax = getAirportLocalObservedTime('KLAX', fixedUtcTimeSec);
    expect(klax.localTimeStr).toBe('05:00');
    expect(klax.tzAbbr).toBe('PDT');
    expect(klax.fullStr).toBe('05:00 PDT');

    // EGLL (London, BST summer): UTC+1 -> 13:00 BST
    const egll = getAirportLocalObservedTime('EGLL', fixedUtcTimeSec);
    expect(egll.localTimeStr).toBe('13:00');
    expect(['BST', 'GMT+1']).toContain(egll.tzAbbr);

    // OMDB (Dubai): UTC+4 -> 16:00 GST
    const omdb = getAirportLocalObservedTime('OMDB', fixedUtcTimeSec);
    expect(omdb.localTimeStr).toBe('16:00');
    expect(omdb.tzAbbr).toBe('GST');
  });

  it('formats correctly when using UTC HHMM string input', () => {
    // "1156" (11:56 UTC)
    const res = getAirportLocalObservedTime('RKSI', '1156');
    // 11 + 9 = 20:56 KST
    expect(res.localTimeStr).toBe('20:56');
    expect(res.tzAbbr).toBe('KST');
  });
});
