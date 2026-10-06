import React, { useEffect, useMemo, useRef, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import PopupSelect, { type PopupOption } from '../common/PopupSelect';
import { useCx3Nav, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useBlankField } from '../../hooks/useBlankField';
import { getAirportTimeZone } from '../../lib/airportTimezone';
import { useConvIcao } from '../../context/ConvIcaoContext';

function formatHM(totalSeconds: number): string {
  if (!isFinite(totalSeconds)) return '--:--';
  const sign = totalSeconds < 0 ? '-' : '';
  let t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600); t -= h * 3600;
  const m = Math.floor(t / 60);
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  return `${sign}${pad(h)}:${pad(m)}`;
}

const PF: Record<string,string> = {A:'America/',E:'Europe/',S:'Asia/',P:'Pacific/',F:'Africa/',L:'Atlantic/',I:'Indian/',U:'Australia/'};
const DID = (s:string):string => PF[s[0]] ? PF[s[0]]+s.slice(1) : s;
const FOF = (m:number):string => { const s=m>=0?'+':'-', a=Math.abs(m); return 'UTC'+s+String(Math.floor(a/60)).padStart(2,'0')+':'+String(a%60).padStart(2,'0'); };
const SEG = (id:string):string => id.split('/').pop() ?? id;
const DEC = (id:string, raw:string):string => {
  const seg = SEG(id).replace(/_/g,' ');
  if (raw === '') return seg;
  if (raw.startsWith('+')) return seg+','+raw.slice(1);
  if (raw.endsWith('$')) return raw.slice(0,-1)+','+seg;
  return raw;
};

// IANA 타임존 ID → TZ_LIST 인덱스 매핑 (공항 코드 입력시 사용)
const IANA_TZ_MAP: Record<string, number> = {
  'America/New_York': -1, 'America/Chicago': -1, 'America/Denver': -1,
  'America/Los_Angeles': -1, 'America/Phoenix': -1, 'America/Anchorage': -1,
  'America/Toronto': -1, 'America/Vancouver': -1, 'America/Edmonton': -1,
  'America/Winnipeg': -1, 'America/Halifax': -1, 'America/St_Johns': -1,
  'America/Mexico_City': -1, 'America/Sao_Paulo': -1, 'America/Buenos_Aires': -1,
  'America/Santiago': -1, 'America/Bogota': -1, 'America/Lima': -1,
  'America/Caracas': -1, 'America/Montevideo': -1, 'America/Asuncion': -1,
  'America/La_Paz': -1, 'America/Guayaquil': -1, 'America/Panama': -1,
  'America/Guatemala': -1, 'America/El_Salvador': -1, 'America/Managua': -1,
  'America/Tegucigalpa': -1, 'America/Costa_Rica': -1, 'America/Santo_Domingo': -1,
  'America/Havana': -1, 'America/Jamaica': -1, 'America/Nassau': -1,
  'America/Puerto_Rico': -1, 'America/Virgin': -1,
  'Pacific/Honolulu': -1, 'Pacific/Guam': -1,
  'Europe/London': -1, 'Europe/Dublin': -1, 'Europe/Paris': -1, 'Europe/Berlin': -1,
  'Europe/Amsterdam': -1, 'Europe/Brussels': -1, 'Europe/Luxembourg': -1,
  'Europe/Zurich': -1, 'Europe/Vienna': -1, 'Europe/Rome': -1, 'Europe/Madrid': -1,
  'Europe/Lisbon': -1, 'Europe/Athens': -1, 'Europe/Prague': -1, 'Europe/Warsaw': -1,
  'Europe/Budapest': -1, 'Europe/Copenhagen': -1, 'Europe/Oslo': -1,
  'Europe/Stockholm': -1, 'Europe/Helsinki': -1, 'Europe/Tallinn': -1,
  'Europe/Riga': -1, 'Europe/Vilnius': -1, 'Europe/Bucharest': -1, 'Europe/Sofia': -1,
  'Europe/Zagreb': -1, 'Europe/Belgrade': -1, 'Europe/Bratislava': -1,
  'Europe/Ljubljana': -1, 'Europe/Sarajevo': -1, 'Europe/Tirana': -1,
  'Europe/Istanbul': -1, 'Europe/Moscow': -1,
  'Asia/Seoul': 15, 'Asia/Tokyo': 15, 'Asia/Shanghai': 14, 'Asia/Hong_Kong': 14,
  'Asia/Taipei': -1, 'Asia/Macau': -1, 'Asia/Singapore': -1, 'Asia/Kuala_Lumpur': -1,
  'Asia/Manila': -1, 'Asia/Bangkok': -1, 'Asia/Ho_Chi_Minh': -1, 'Asia/Phnom_Penh': -1,
  'Asia/Vientiane': -1, 'Asia/Yangon': -1, 'Asia/Jakarta': -1, 'Asia/Makassar': -1,
  'Asia/Kolkata': -1, 'Asia/Colombo': -1, 'Asia/Dhaka': -1, 'Asia/Karachi': -1,
  'Asia/Kathmandu': -1, 'Asia/Dubai': -1, 'Asia/Muscat': -1, 'Asia/Qatar': -1,
  'Asia/Bahrain': -1, 'Asia/Kuwait': -1, 'Asia/Riyadh': -1, 'Asia/Jerusalem': -1,
  'Asia/Amman': -1, 'Asia/Beirut': -1, 'Asia/Damascus': -1, 'Asia/Baghdad': -1,
  'Asia/Tehran': -1, 'Asia/Kabul': -1, 'Asia/Almaty': -1, 'Asia/Tashkent': -1,
  'Asia/Baku': -1, 'Asia/Tbilisi': -1, 'Asia/Yerevan': -1,
  'Asia/Pyongyang': -1, 'Asia/Ulaanbaatar': -1, 'Asia/Nicosia': -1,
  'Asia/Brunei': -1, 'Asia/Maldives': -1,
  'Australia/Sydney': -1, 'Australia/Melbourne': -1, 'Australia/Brisbane': -1,
  'Australia/Perth': -1, 'Australia/Adelaide': -1, 'Australia/Darwin': -1,
  'Australia/Hobart': -1,
  'Pacific/Auckland': -1, 'Pacific/Fiji': -1, 'Pacific/Noumea': -1,
  'Pacific/Port_Moresby': -1, 'Pacific/Nadi': -1,
  'Africa/Cairo': -1, 'Africa/Johannesburg': -1, 'Africa/Nairobi': -1,
  'Africa/Addis_Ababa': -1, 'Africa/Lagos': -1, 'Africa/Casablanca': -1,
  'Africa/Tunis': -1, 'Africa/Algiers': -1,
  'Atlantic/Reykjavik': -1,
  'Indian/Maldives': -1,
};
const TZ_RAW = `P-10,-600,Daniel,Fa'a'ā
A-8,-480,Ted
A-7,-420,Harry Reid,Los Angeles,San,Seattle–Taco,Vancouver
A-6,-360,Denver
A-5,-300,Chicago,Dallas
A-4,-240,Hartsfield,John,Miami,Newark,Toronto,Washington
E0,0,London
E1,60,Adolfo,Amsterdam,Brussels,Charles,Copenhagen,Frankfurt,Josep,Luxembourg-F,Milan,Munich,Nice-Côte,Oslo-Garderm,Rome–Fiumicino,Stockholm-Ar,Vienna,Václav,Zagreb,Zürich
E2,120,Cairo,Helsinki
E3,180,Bahrain,Hamad,Jomo,King,King Khalid,Kuwait,Mehrabad,Pulkovo,Sheremetyevo,İstanbul
E4,240,Dubai,Muscat,Zayed
S5,300,Bandaranaike,Chhatrapati,Indira,Tribhuvan,Velana
S6,360,Hazrat,Yangon
S7,420,Chiang Mai,Da Nang,Noi Bai,Novosibirsk,Phnom Penh,Phuket,Siem,Soekarno-Hat,Suvarnabhumi,Tan Son Nhat
S8,480,Beijing,Changchun,Changsha,Chengdu,Chifeng,Chongqing,Dalian,Denpasar,Fuzhou,Guangzhou,Hangzhou,Harbin,Hefei,Hohhot Baita,Hong Kong,Hotan,Irkutsk,Jinan,Kuala Lumpur,Kunming,Lanzhou,Lianyungang,Macau,Mactan Cebu,Mudanjiang,Nanchang,Nanjing,Ningbo Lishe,Ninoy Aquino,Qingdao,Qiqihar,Quanzhou,Shanghai,Shanghai,Shenyang,Shenzhen,Shijiazhuang,Singapore,Taiwan,Tianjin,Ulaanbaatar,Weihai,Wenzhou,Wuhan Tianhe,Xi'an,Xiamen Gaoqi,Yanji,Yantai,Yinchuan,Yiwu,Zhangjiajie,Zhengzhou
S9,540,Seoul
S10,600,Antonio,Brisbane,Khabarovsk,Saipan,Vladivostok
U11,660,Melbourne,Sydney
P12,720,Nadi
S13,780,Auckland,Christchurch`;

interface TzEntry { id: string; name: string; offset: string; offMin: number; }

// 공항 정보
interface AirportEntry {
  code: string;      // IATA (e.g. ICN)
  ident: string;     // ICAO (e.g. RKSI)
  lat: number;
  lon: number;
  tzOffset: string;  // e.g. UTC+9
  name: string;      // e.g. "Incheon International Airport, Seoul"
}

// CSV raw data (airports_timezones.csv)
const AIRPORTS_CSV = `code,ident,latitude_deg,longitude_deg,time_zone,name
YVR,CYVR,49.193044,-123.1798642,UTC-7,Vancouver International Airport
YYZ,CYYZ,43.681583,-79.61146,UTC-4,Toronto Pearson International Airport
BRU,EBBR,50.9010343,4.478626970832147,UTC+1,"Brussels Airport, Zaventem"
FRA,EDDF,50.0229437,8.524938151916214,UTC+1,"Frankfurt Main Airport, Frankfurt am Main"
MUC,EDDM,48.353004,11.790143,UTC+1,Munich Airport
HEL,EFHK,60.32135905,24.947206800038444,UTC+2,"Helsinki Vantaa Airport, Helsinki (Vantaa)"
LHR,EGLL,51.46773895,-0.458780074,UTC+0,London Heathrow Airport
AMS,EHAM,52.32697895,4.741505200022974,UTC+1,Amsterdam Airport Schiphol
CPH,EKCH,55.6091282,12.650982248393536,UTC+1,Copenhagen Kastrup Airport
LUX,ELLX,49.62637155,6.209403407206421,UTC+1,Luxembourg-Findel International Airport
OSL,ENGM,60.19786535,11.09967535417638,UTC+1,"Oslo-Gardermoen International Airport, Oslo (Gardermoen)"
ARN,ESSA,59.6467921,17.937044334194475,UTC+1,Stockholm-Arlanda Airport
CAI,HECA,30.1141148,31.42470226006945,UTC+2,Cairo International Airport
NBO,HKJK,-1.3168547,36.92904912198662,UTC+3,"Jomo Kenyatta International Airport, Nairobi"
ATL,KATL,33.63779875,-84.42927119,UTC-4,Hartsfield Jackson Atlanta International Airport
DEN,KDEN,39.8606676,-104.6853673,UTC-6,Denver International Airport
DFW,KDFW,32.89651945,-97.04652205,UTC-5,"Dallas Fort Worth International Airport, Dallas-Fort Worth"
EWR,KEWR,40.68906405,-74.17725485,UTC-4,Newark Liberty International Airport
IAD,KIAD,38.95226625,-77.45348491,UTC-4,Washington Dulles International Airport
JFK,KJFK,40.6429479,-73.77937337,UTC-4,"John F. Kennedy International Airport, New York"
LAS,KLAS,36.0861034,-115.1611199,UTC-7,"Harry Reid International Airport, Las Vegas"
LAX,KLAX,33.94216754999999,-118.421393,UTC-7,Los Angeles International Airport
MIA,KMIA,25.7949789,-80.28672341,UTC-4,Miami International Airport
ORD,KORD,41.97795725,-87.90917585,UTC-5,Chicago O'Hare International Airport
SEA,KSEA,47.4475673,-122.3080159,UTC-7,Seattle–Tacoma International Airport
SFO,KSFO,37.622452,-122.3840716,UTC-7,San Francisco International Airport
ZAG,LDZA,45.74027185,16.07231616098094,UTC+1,"Zagreb Franjo Tuđman International Airport, Velika Gorica"
BCN,LEBL,41.29694395,2.079047362981321,UTC+1,Josep Tarradellas Barcelona-El Prat Airport
MAD,LEMD,40.4948384,-3.574080621,UTC+1,Adolfo Suárez Madrid–Barajas Airport
NCE,LFMN,43.65980345,7.213706629141443,UTC+1,"Nice-Côte d'Azur Airport, Nice, Alpes-Maritimes"
CDG,LFPG,49.0068908,2.571081969101916,UTC+1,"Charles de Gaulle International Airport, Paris (Roissy-en-France, Val-d'Oise)"
MXP,LIMC,45.6296273,8.723547468967393,UTC+1,"Milan Malpensa International Airport, Ferno (VA)"
FCO,LIRF,41.8144309,12.22690120488078,UTC+1,Rome–Fiumicino Leonardo da Vinci International Airport
PRG,LKPR,50.1020451,14.27056489323675,UTC+1,Václav Havel Airport Prague
VIE,LOWW,48.10499675,16.5848987,UTC+1,Vienna International Airport
ZRH,LSZH,47.4635489,8.553204683227131,UTC+1,"Zürich Airport, Zurich"
IST,LTFM,40.9912282,28.8298952,UTC+3,"İstanbul Airport, Istanbul"
NAN,NFFN,-17.7624533,177.43747042786867,UTC+12,Nadi International Airport
PPT,NTAA,-17.55418205,-149.6103369,UTC-10,"Fa'a'ā International Airport, Papeete"
AKL,NZAA,-37.00889695,174.7912138412501,UTC+13,Auckland International Airport
CHC,NZCH,-43.4847958,172.53575429898345,UTC+13,Christchurch International Airport
BAH,OBBI,26.2697012,50.632903208060256,UTC+3,"Bahrain International Airport, Manama"
JED,OEJN,21.6836591,39.16367476310531,UTC+3,"King Abdulaziz International Airport, Jeddah"
RUH,OERK,24.95929,46.702877,UTC+3,"King Khalid International Airport, Riyadh"
THR,OIII,35.6979248,51.278399738353954,UTC+3,"Mehrabad International Airport, Tehran"
KWI,OKBK,29.2202789,47.95511083306344,UTC+3,"Kuwait International Airport, Kuwait City"
AUH,OMAA,24.43189915,54.64197668,UTC+4,"Zayed International Airport, Abu Dhabi"
DXB,OMDB,25.248665,55.352917,UTC+4,Dubai International Airport
MCT,OOMS,23.599458,58.29212963328453,UTC+4,"Muscat International Airport, Muscat/Seeb"
DOH,OTHH,25.267569,51.558067,UTC+3,"Hamad International Airport, Doha"
ANC,PANC,61.18103525,-149.9978919,UTC-8,Ted Stevens Anchorage International Airport
SPN,PGSN,15.12049075,145.72962519467052,UTC+10,"Saipan International Airport, I Fadang, Saipan"
GUM,PGUM,13.492787,144.80486,UTC+10,"Antonio B. Won Pat International Airport, Hagåtña"
HNL,PHNL,21.32040435,-157.9173135,UTC-10,"Daniel K. Inouye International Airport, Honolulu, Oahu"
ROR,PTRO,7.366885099999999,134.54430649330376,UTC+9,"Roman Tmetuchl International Airport, Babelthuap Island"
TPE,RCTP,25.07931745,121.23459767526803,UTC+8,Taiwan Taoyuan International Airport
NRT,RJAA,35.77587145,140.3933101399336,UTC+9,Narita International Airport
KIX,RJBB,34.43420455,135.2225230169576,UTC+9,"Kansai International Airport, Osaka"
UKB,RJBE,34.63428055,135.22785050798507,UTC+9,Kobe Airport
CTS,RJCC,42.786787,141.68295976251358,UTC+9,"New Chitose Airport, Sapporo"
FUK,RJFF,33.586802,130.44739386660302,UTC+9,Fukuoka Airport
KOJ,RJFK,31.803187,130.718951,UTC+9,Kagoshima Airport
KMJ,RJFT,32.8362322,130.85543996230052,UTC+9,Kumamoto Airport
NGS,RJFU,32.917846,129.91545060447868,UTC+9,Nagasaki Airport
NGO,RJGG,34.858719699999995,136.81136334974985,UTC+9,"Chubu Centrair International Airport, Tokoname"
KMQ,RJNK,36.39344695,136.4092464012111,UTC+9,"Komatsu Airport / JASDF Komatsu Air Base, Kanazawa"
OKJ,RJOB,34.75697285,133.8538693555767,UTC+9,Okayama Momotaro Airport
AOJ,RJSA,40.7340525,140.689686,UTC+9,Aomori Airport
KIJ,RJSN,37.9555294,139.118527,UTC+9,Niigata Airport
HND,RJTT,35.54572095,139.78058713123818,UTC+9,Tokyo Haneda International Airport
MWX,RKJB,34.991280200000006,126.38414054753376,UTC+9,"Muan International Airport, Muan (Piseo-ri)"
KWJ,RKJJ,35.140833400000005,126.81177837965002,UTC+9,Gwangju Airport
KUV,RKJK,35.983334,126.75,UTC+9,Gunsan Airport / Gunsan Air Base
CHN,RKJU,37.016945,127.933334,UTC+9,Jeonju (G 703) Air Base
RSU,RKJY,34.84243345,127.61618910716165,UTC+9,Yeosu Airport
WJU,RKNW,37.43917275,127.96739325776014,UTC+9,Wonju Airport / Hoengseong Air Base (K-38/K-46)
YNY,RKNY,38.066666,128.6,UTC+9,"Yangyang International Airport, Gonghang-ro"
CJU,RKPC,33.50707105,126.4916441196128,UTC+9,"Jeju International Airport, Jeju City"
PUS,RKPK,35.1800774,128.93640137086572,UTC+9,"Gimhae International Airport, Busan"
HIN,RKPS,35.0921956,128.08665041662874,UTC+9,Sacheon Airport / Sacheon Air Base
USN,RKPU,35.5935453,129.35279208634356,UTC+9,Ulsan Airport
ICN,RKSI,37.4634169,126.44164409450852,UTC+9,"Incheon International Airport, Seoul"
GMP,RKSS,37.55900775,126.7942402657747,UTC+9,Seoul Gimpo International Airport
KPO,RKTH,35.9878003,129.4206163073351,UTC+9,Pohang Airport (G-815/K-3)
TAE,RKTN,35.8979585,128.6516654,UTC+9,Daegu International Airport
CJJ,RKTU,36.7155563,127.4974642747912,UTC+9,Cheongju International Airport/Cheongju Air Base (K-59/G-513)
OKA,ROAH,26.1966997,127.6489520891715,UTC+9,Naha International Airport
MNL,RPLL,14.5123016,121.02188606807516,UTC+8,"Ninoy Aquino International Airport, Manila (Pasay)"
CEB,RPVM,10.310328,123.97927764356774,UTC+8,"Mactan Cebu International Airport, Cebu City/Lapu-Lapu City"
KHV,UHHH,48.528096,135.18291320418953,UTC+10,Khabarovsk Novy Airport
VVO,UHWW,43.3925287,132.14617665194015,UTC+10,"Vladivostok International Airport, Artyom"
IKT,UIII,52.273308,104.35607,UTC+8,Irkutsk International Airport
LED,ULLI,59.8016986,30.267601113109503,UTC+3,"Pulkovo Airport, St. Petersburg"
OVB,UNNT,55.00901,82.667,UTC+7,Novosibirsk Tolmachevo Airport
SVO,UUEE,55.97608755,37.42380082,UTC+3,"Sheremetyevo International Airport, Moscow"
BOM,VABB,19.0901312,72.86370318520977,UTC+5,"Chhatrapati Shivaji Maharaj International Airport, Mumbai"
CMB,VCBI,7.17970025,79.88399637,UTC+5,Bandaranaike International Colombo Airport
PNH,VDPP,11.5470571,104.84811156075016,UTC+7,"Phnom Penh International Airport, Phnom Penh (Pou Senchey)"
REP,VDSR,13.41068555,103.81347888302334,UTC+7,Siem Reap Angkor International Airport
DAC,VGHS,23.84229135,90.40375285964708,UTC+6,"Hazrat Shahjalal International Airport, Dhaka"
HKG,VHHH,22.3125986,113.9173237864194,UTC+8,Hong Kong International Airport
DEL,VIDP,28.5551678,77.08473847979485,UTC+5,"Indira Gandhi International Airport, New Delhi"
MFM,VMMC,22.149929,113.58936073979396,UTC+8,"Macau International Airport, Nossa Senhora do Carmo"
KTM,VNKT,27.6939119,85.35821974,UTC+5,"Tribhuvan International Airport, Kathmandu"
MLE,VRMM,4.1961894,73.53010416,UTC+5,"Velana International Airport, Malé"
BKK,VTBS,13.68187665,100.74858027718852,UTC+7,"Suvarnabhumi Airport, Bangkok"
CNX,VTCC,18.76684265,98.96487808920725,UTC+7,Chiang Mai International Airport
HKT,VTSP,8.11013195,98.30581527719204,UTC+7,Phuket International Airport
DAD,VVDN,16.0425792,108.19716127833767,UTC+7,Da Nang International Airport
HAN,VVNB,21.2190339,105.8044969796485,UTC+7,"Noi Bai International Airport, Hanoi (Soc Son)"
SGN,VVTS,10.81831885,106.65812173979047,UTC+7,"Tan Son Nhat International Airport, Ho Chi Minh City"
RGN,VYYY,16.91201185,96.13661261066854,UTC+6,Yangon International Airport
DPS,WADD,-8.7458582,115.16733897840363,UTC+8,"Denpasar I Gusti Ngurah Rai International Airport, Kuta, Badung"
CGK,WIII,-6.12389155,106.65658968644006,UTC+7,"Soekarno-Hatta International Airport, Jakarta"
KUL,WMKK,2.74476355,101.7066224803332,UTC+8,"Kuala Lumpur International Airport, Sepang"
SIN,WSSS,1.361173,103.990204,UTC+8,Singapore Changi Airport
BNE,YBBN,-27.3874138,153.1214764569645,UTC+10,Brisbane International Airport
MEL,YMML,-37.667111,144.83348076679553,UTC+11,Melbourne Airport
SYD,YSSY,-33.9498935,151.18196819346016,UTC+11,"Sydney Kingsford Smith International Airport, Sydney (Mascot)"
PEK,ZBAA,40.07915555,116.5942601992765,UTC+8,Beijing Capital International Airport
CIF,ZBCF,42.237392,118.91089,UTC+8,Chifeng Yulong Airport
HET,ZBHH,40.8508981,111.81798726025258,UTC+8,Hohhot Baita International Airport
SJW,ZBSJ,38.2803561,114.6896449790578,UTC+8,Shijiazhuang Zhengding International Airport
TSN,ZBTJ,39.12745995,117.3548361759388,UTC+8,Tianjin Binhai International Airport
DYG,ZGDY,29.1038685,110.44472066563624,UTC+8,"Zhangjiajie Hehua International Airport, Zhangjiajie (Yongding)"
CAN,ZGGG,23.3931854,113.3015079267467,UTC+8,"Guangzhou Baiyun International Airport, Guangzhou (Huadu)"
CSX,ZGHA,28.19066605,113.21991433924588,UTC+8,"Changsha Huanghua International Airport, Changsha (Changsha)"
SZX,ZGSZ,22.6376434,113.80607686281571,UTC+8,Shenzhen Bao'an International Airport
CGO,ZHCC,34.5270534,113.84801423633316,UTC+8,Zhengzhou Xinzheng International Airport
WUH,ZHHH,30.77382425,114.21236810445087,UTC+8,"Wuhan Tianhe International Airport, Wuhan (Huangpi)"
INC,ZLIC,38.3211525,106.38861654513931,UTC+8,Yinchuan Hedong International Airport
LHW,ZLLL,36.033333,103.86667,UTC+8,"Lanzhou Zhongchuan International Airport, Lanzhou (Yongdeng)"
XIY,ZLXY,34.43866385,108.7580567206632,UTC+8,Xi'an Xianyang International Airport
UBN,ZMCK,47.65,106.818889,UTC+8,"Ulaanbaatar Chinggis Khaan International Airport, Ulaanbaatar (Sergelen)"
KMG,ZPPP,25.10710645,102.93841345267796,UTC+8,Kunming Changshui International Airport
XMN,ZSAM,24.54383005,118.13265145897324,UTC+8,Xiamen Gaoqi International Airport
KHN,ZSCN,28.8616845,115.90823277913566,UTC+8,Nanchang Changbei International Airport
FOC,ZSFZ,25.93452545,119.66617231883538,UTC+8,"Fuzhou Changle International Airport, Fuzhou (Changle)"
HGH,ZSHC,30.2368729,120.42912444938366,UTC+8,Hangzhou Xiaoshan International Airport
TNA,ZSJN,36.8572453,117.21173410272696,UTC+8,"Jinan Yaoqiang International Airport, Jinan (Licheng)"
LYG,ZSLG,34.57096,118.87475668663636,UTC+8,Lianyungang Huaguoshan International Airport
NGB,ZSNB,29.8261878,121.45840490871828,UTC+8,Ningbo Lishe International Airport
NKG,ZSNJ,31.7318395,118.8722909841032,UTC+8,Nanjing Lukou International Airport
HFE,ZSOF,31.85,117.28333,UTC+8,Hefei Xinqiao International Airport
PVG,ZSPD,31.14134505,121.80463662688626,UTC+8,"Shanghai Pudong International Airport, Shanghai (Pudong)"
TAO,ZSQD,36.26799135,120.3767926456306,UTC+8,"Qingdao Jiaodong International Airport, Qingdao (Jiaozhou)"
JJN,ZSQZ,24.79702915,118.588705,UTC+8,Quanzhou Jinjiang International Airport
SHA,ZSSS,31.19767765,121.33448312534463,UTC+8,"Shanghai Hongqiao International Airport, Shanghai (Minhang)"
WEH,ZSWH,37.1864922,122.2294086093108,UTC+8,Weihai Dashuibo Airport
WNZ,ZSWZ,27.9087893,120.84686367619172,UTC+8,"Wenzhou Longwan International Airport, Wenzhou (Longwan)"
YNT,ZSYT,37.407326,121.3711,UTC+8,Yantai Penglai International Airport
YIW,ZSYW,29.3422048,120.02868898781664,UTC+8,"Yiwu Airport, Yiwu/Jinhua"
CKG,ZUCK,29.72606975,106.64983063307892,UTC+8,Chongqing Jiangbei International Airport
CTU,ZUUU,30.5547767,103.9479446811554,UTC+8,"Chengdu Shuangliu International Airport, Chengdu (Shuangliu)"
HTN,ZWTN,37.03216015,79.86284691607489,UTC+8,Hotan Airport
CGQ,ZYCC,43.902836,125.217545,UTC+8,Changchun Longjia International Airport
HRB,ZYHB,45.62212125,126.24525735616052,UTC+8,Harbin Taiping International Airport
MDG,ZYMD,44.5245786,129.56714084864257,UTC+8,Mudanjiang Hailang International Airport
NDG,ZYQQ,47.316666,123.916664,UTC+8,Qiqihar Sanjiazi Airport
DLC,ZYTL,38.96412695,121.5414272375336,UTC+8,"Dalian Zhoushuizi International Airport, Dalian (Ganjingzi)"
SHE,ZYTX,41.861084,123.426926,UTC+8,Shenyang Taoxian International Airport
YNJ,ZYYJ,42.8787858,129.4487048951637,UTC+8,Yanji Chaoyangchuan Airport`;

// ICAO(ident) → AirportEntry lookup
const AIRPORT_MAP: Record<string, AirportEntry> = (() => {
  const map: Record<string, AirportEntry> = {};
  const lines = AIRPORTS_CSV.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted fields (name may contain commas)
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);
    if (parts.length < 6) continue;
    const [code, ident, latStr, lonStr, tzOffset, name] = parts;
    map[ident.toUpperCase()] = {
      code,
      ident: ident.toUpperCase(),
      lat: parseFloat(latStr),
      lon: parseFloat(lonStr),
      tzOffset,
      name,
    };
  }
  return map;
})();

const TZ_LIST: TzEntry[] = (() => {
  const rows = TZ_RAW.split('\n').filter(Boolean);
  const out: TzEntry[] = [{ id: 'UTC', name: 'UTC', offset: 'UTC+00:00', offMin: 0 }];
  for (const r of rows) {
    const p = r.split(',');
    if (p.length < 2) continue;
    const id = DID(p[0]);
    const mn = parseInt(p[1], 10);
    if (!isFinite(mn)) continue;
    const raw = p.length >= 3 ? p.slice(2).join(',') : '';
    const name = DEC(id, raw);
    out.push({ id, name, offset: FOF(mn), offMin: mn });
  }
  // IANA 타임존 ID → TZ_LIST 인덱스 채우기
  // TZ_RAW의 각 항목을 IANA ID와 매칭 (prefix+offset 기반)
  for (const [ianaId] of Object.entries(IANA_TZ_MAP)) {
    const prefix = ianaId.split('/')[0]; // 'America', 'Asia', 'Europe' 등
    const pfxKey = Object.entries(PF).find(([, v]) => v.startsWith(prefix + '/'))?.[0];
    if (!pfxKey) continue;
    // 같은 prefix를 가진 TZ_LIST 항목 중 offMin이 같은 것을 찾음
    // (IANA ID의 현재 offset을 계산)
    try {
      const offsetMin = -new Date().getTimezoneOffset(); // 로컬이 아니라 IANA 기준
      // IANA ID의 현재 UTC offset 계산
      const parts = Intl.DateTimeFormat('en', {
        timeZone: ianaId, timeZoneName: 'shortOffset',
      } as Intl.DateTimeFormatOptions).formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      // 'GMT+9' → 540, 'GMT-5' → -300
      const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const h = parseInt(match[2], 10);
        const m = match[3] ? parseInt(match[3], 10) : 0;
        const ianaOffMin = sign * (h * 60 + m);
        const idx = out.findIndex(e => e.offMin === ianaOffMin && e.id.startsWith(prefix));
        if (idx >= 0) IANA_TZ_MAP[ianaId] = idx;
      }
    } catch {
      // Intl 미지원 환경 무시
    }
  }
  return out;
})();

type PopupTarget = 'from' | 'to' | null;
type IcaoTarget = 'from' | 'to' | null;
const LINES = ['TIME', 'FROM', 'TO', 'OUT'] as const;

const DEFAULT_FROM = TZ_LIST.findIndex(t => t.id === 'Asia/Seoul');
const DEFAULT_TO = TZ_LIST.findIndex(t => t.id === 'Asia/Tokyo');

export default function TimeZoneScreen() {
  const { replaceTop } = useCx3Router();
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const time = useBlankField('time', '');
  const [fromIdx, setFromIdx] = useState(DEFAULT_FROM >= 0 ? DEFAULT_FROM : 0);
  const [toIdx, setToIdx] = useState(DEFAULT_TO >= 0 ? DEFAULT_TO : (TZ_LIST.length > 1 ? 1 : 0));
  const [popupTarget, setPopupTarget] = useState<PopupTarget>(null);
  const [icaoTarget, setIcaoTarget] = useState<IcaoTarget>(null);
  const [icaoDraft, setIcaoDraft] = useState('');
  const icaoInputRef = useRef<HTMLInputElement>(null);
  const { setIcaoActive } = useConvIcao();

  const tzOptions = useMemo<PopupOption<string>[]>(() =>
    TZ_LIST.map(tz => {
      const prettyName = tz.name.replace(/,(\S)/g, ', $1');
      const seg = tz.id.split('/').pop() ?? tz.id;
      const isLong = prettyName.length > 20;
      return {
        id: tz.id,
        label: prettyName,
        unit: tz.offset,
        right: isLong ? '' : seg,
      };
    }), []);

  const openPopup = (t: 'from' | 'to') => setPopupTarget(t);
  const closePopup = () => setPopupTarget(null);

  const openIcaoInput = (t: 'from' | 'to') => {
    setIcaoTarget(t);
    setIcaoDraft('');
    setIcaoName('');
    setIcaoActive(true);
  };
  const closeIcaoInput = () => {
    setIcaoTarget(null);
    setIcaoDraft('');
    setIcaoName('');
    setIcaoActive(false);
  };
  const [icaoName, setIcaoName] = useState('');
  // 4자리 ICAO 코드 자동 커밋
  useEffect(() => {
    if (icaoDraft.length === 4) {
      setIcaoName(AIRPORT_MAP[icaoDraft]?.name.split(',')[0].trim() ?? '');
      setTimeout(() => commitIcao(icaoDraft), 0);
    } else if (icaoDraft.length >= 3) {
      setIcaoName(AIRPORT_MAP[icaoDraft]?.name.split(',')[0].trim() ?? '');
    } else {
      setIcaoName('');
    }
  }, [icaoDraft]);
  const commitIcao = (code: string) => {
    const icao = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (icao.length !== 4) return;
    // CSV에서 공항 정보 조회
    const airport = AIRPORT_MAP[icao];
    const airportName = airport ? airport.name.split(',')[0].trim() : '';
    // 타임존 매칭
    const tz = getAirportTimeZone(icao);
    // 1) IANA_TZ_MAP에서 직접 매칭
    let idx = IANA_TZ_MAP[tz];
    // 2) 없으면 TZ_LIST id로 직접 검색
    if (idx === undefined || idx < 0) {
      idx = TZ_LIST.findIndex(t => t.id === tz);
    }
    // 3) 그래도 없으면 CSV의 tzOffset으로 매칭 (예: UTC+9)
    if (idx < 0 && airport) {
      const offMatch = airport.tzOffset.match(/UTC([+-])(\d+)(?::(\d+))?/);
      if (offMatch) {
        const sign = offMatch[1] === '+' ? 1 : -1;
        const h = parseInt(offMatch[2], 10);
        const m = offMatch[3] ? parseInt(offMatch[3], 10) : 0;
        const csvOffMin = sign * (h * 60 + m);
        idx = TZ_LIST.findIndex(t => t.offMin === csvOffMin);
      }
    }
    // 4) 그래도 없으면 tz prefix로 같은 prefix의 첫 번째 항목 사용
    if (idx < 0) {
      const prefix = tz.split('/')[0];
      idx = TZ_LIST.findIndex(t => t.id.startsWith(prefix));
    }
    if (idx >= 0) {
      if (icaoTarget === 'from') {
        setFromIdx(idx === toIdx ? (idx === 0 ? 1 : 0) : idx);
      } else if (icaoTarget === 'to') {
        setToIdx(idx === fromIdx ? (idx === 0 ? 1 : 0) : idx);
      }
    }
    closeIcaoInput();
  };

  const onSelectTz = (id: string) => {
    const i = TZ_LIST.findIndex(t => t.id === id);
    if (i < 0) { closePopup(); return; }
    if (popupTarget === 'from') {
      setFromIdx(i === toIdx ? (i === 0 ? 1 : 0) : i);
    } else if (popupTarget === 'to') {
      setToIdx(i === fromIdx ? (i === 0 ? 1 : 0) : i);
    }
    closePopup();
  };

  useEffect(() => {
    if (popupTarget) return;
  }, [popupTarget]);

  // POWER 키는 useCx3OnEnter(priority 9)보다 먼저 처리해야 하므로 priority 8로 별도 등록
  useOnCx3Key((k: Cx3KeyId) => {
    if (popupTarget !== null) return undefined;

    // ICAO 입력 모드: POWER/GO로 확인
    if (icaoTarget !== null) {
      if (k === 'POWER' || k === 'GO') {
        commitIcao(icaoDraft);
        return 'stop';
      }
      return undefined;
    }

    // 일반 모드: SET FROM(1) 또는 CONV TO(2) 행에서 POWER → 공항코드 입력
    if (k === 'POWER') {
      if (cursor === 1) { openIcaoInput('from'); return 'stop'; }
      if (cursor === 2) { openIcaoInput('to'); return 'stop'; }
      return undefined;
    }
    return undefined;
  }, [cursor, fromIdx, toIdx, popupTarget, icaoTarget, icaoDraft], 8);

  useOnCx3Key((k: Cx3KeyId) => {
    if (popupTarget !== null) return undefined;

    // ICAO 입력 모드
    if (icaoTarget !== null) {
      if (k === 'BACK') { closeIcaoInput(); return 'stop'; }
      if (k === 'CLR') { setIcaoDraft(''); return 'stop'; }
      if (k === 'BKSP') {
        setIcaoDraft(prev => prev.slice(0, -1));
        return 'stop';
      }
      if (/^[A-Z]$/.test(k)) {
        setIcaoDraft(prev => {
          if (prev.length >= 4) return prev;
          const next = prev + k;
          // 공항 이름 미리보기 업데이트
          const fullCode = next.length < 4 ? icaoDraft + k : next;
          setIcaoName('');
          return next;
        });
        return 'stop';
      }
      return undefined;
    }

    if (k === 'BACK') { replaceTop('CONV', 'CONV'); return 'stop'; }
    if (k === 'CONVU') {
      if (cursor === 1) { openPopup('from'); return 'stop'; }
      if (cursor === 2) { openPopup('to'); return 'stop'; }
    }
    const f = cursor === 0 ? time : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN') { return undefined; }
    if (k === 'DOT') { return undefined; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, fromIdx, toIdx, replaceTop, time, popupTarget, icaoTarget, icaoDraft], 12);

  const { outHMS, deltaSign, deltaH, deltaM } = useMemo(() => {
    const fromMin = TZ_LIST[fromIdx].offMin;
    const toMin = TZ_LIST[toIdx].offMin;
    const deltaMin = toMin - fromMin;
    const rawSec = time.toNum();
    if (!isFinite(rawSec)) return { outHMS: '--', deltaSign: '', deltaH: NaN, deltaM: NaN };
    const utcSec = rawSec - (fromMin * 60);
    const total = utcSec + (toMin * 60);
    const mod = ((total % 86400) + 86400) % 86400;
    const h = Math.floor(mod / 3600);
    const m = Math.floor((mod - h * 3600) / 60);
    const outMM = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const absMin = Math.abs(deltaMin);
    return {
      outHMS: outMM,
      deltaSign: deltaMin >= 0 ? '+' : '−',
      deltaH: Math.floor(absMin / 60),
      deltaM: absMin % 60,
    };
  }, [time.value, fromIdx, toIdx]);

  const OUT_DISP = isFinite(deltaH as any)
    ? `${outHMS} (${deltaSign}${deltaH}${deltaM ? ':' + deltaM.toString().padStart(2, '0') : ''}h)`
    : '--';

  const clickRow = (idx: number) => {
    dispatch({ type: 'SET_CURSOR', idx });
    if (idx === 1) openIcaoInput('from');
    else if (idx === 2) openIcaoInput('to');
  };

  const TZ_COUNT = TZ_LIST.length;

  const timeDisplay = useMemo(() => {
    if (time.isBlank) return '--';
    const t = time.toNum();
    return formatHM(t);
  }, [time.isBlank, time.value]);

  const icaoLabel = icaoTarget === 'from' ? 'SET FROM' : icaoTarget === 'to' ? 'CONV TO' : '';

  return (
    <>
      {icaoTarget !== null ? (
        <div className="cx3-lcd-menu timezone-lcd-menu">
          <div style={{ padding: '8px 6px', borderBottom: '1px solid var(--cx3-lcd-divider)' }}>
            <div style={{ fontSize: 12, color: 'var(--cx3-lcd-amber)', marginBottom: 4 }}>
              {icaoLabel} · ICAO Airport Code (4 letters)
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px', border: '1px solid var(--cx3-lcd-green)',
              borderRadius: 4, background: 'rgba(0,0,0,0.25)',
            }}>
              <span style={{ color: 'var(--cx3-lcd-fg)', fontSize: 13, fontWeight: 600 }}>ICAO</span>
              <input
                ref={icaoInputRef}
                type="text" inputMode="none" autoCapitalize="characters" autoCorrect="off"
                autoComplete="off" spellCheck={false} maxLength={4} placeholder="RKPC"
                readOnly
                value={icaoDraft}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--cx3-lcd-green)', fontFamily: 'JetBrains Mono, Consolas, "SF Mono", Menlo, monospace',
                  fontSize: 18, fontWeight: 800, textAlign: 'center', letterSpacing: 6,
                  caretColor: 'transparent', textTransform: 'uppercase',
                }}
              />
            </div>
            {icaoName && (
              <div style={{
                marginTop: 8, padding: '4px 8px', borderRadius: 4,
                background: 'rgba(0,200,0,0.08)', textAlign: 'center',
                fontSize: 12, color: 'var(--cx3-lcd-green)', fontWeight: 500,
              }}>
                {icaoName}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--cx3-lcd-fg)', opacity: 0.5, marginTop: 6, textAlign: 'center' }}>
              Type 4-letter ICAO code · POWER/GO to confirm
            </div>
          </div>
          <div style={{ padding: '6px', opacity: 0.4, fontSize: 11, color: 'var(--cx3-lcd-fg)' }}>
            {icaoTarget === 'from' ? `Current: ${TZ_LIST[fromIdx].name}` : `Current: ${TZ_LIST[toIdx].name}`}
          </div>
        </div>
      ) : (
        <div className="cx3-lcd-menu timezone-lcd-menu">
          <div onClick={() => clickRow(0)}>
            <Cx3Line label={'Time (HH:MM)'} valueDisplay={timeDisplay} unit={'HH:MM'}
              state={time.isBlank ? 'unsolved' : 'input'} cursor={cursor === 0}
              valueClass={time.isBlank ? 'dashes' : 'default'} />
          </div>
          <div onClick={() => clickRow(1)}>
            <Cx3Line label={'SET FROM'} valueDisplay={TZ_LIST[fromIdx].name} unit={TZ_LIST[fromIdx].offset.replace('UTC', '')}
              state={'input'} cursor={cursor === 1} valueClass={'default'} />
          </div>
          <div onClick={() => clickRow(2)}>
            <Cx3Line label={'CONV TO'} valueDisplay={TZ_LIST[toIdx].name} unit={TZ_LIST[toIdx].offset.replace('UTC', '')}
              state={'input'} cursor={cursor === 2} valueClass={'default'} />
          </div>
          <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 3 })}>
            <Cx3Line label={'Local Time'} valueDisplay={OUT_DISP} unit={'TZ'}
              state={OUT_DISP === '--' ? 'unsolved' : 'calc'}
              cursor={cursor === 3}
              valueClass={OUT_DISP === '--' ? 'dashes' : 'green'} />
          </div>
        </div>
      )}

      <PopupSelect<string>
        open={popupTarget !== null}
        title={popupTarget === 'from' ? `SET FROM TimeZone · ${TZ_COUNT}종` : popupTarget === 'to' ? `CONV TO TimeZone · ${TZ_COUNT}종` : ''}
        options={tzOptions}
        windowSize={6}
        selectedId={
          popupTarget === 'from' ? TZ_LIST[fromIdx].id :
          popupTarget === 'to'   ? TZ_LIST[toIdx].id   :
          undefined
        }
        onClose={closePopup}
        onSelect={onSelectTz}
      />
    </>
  );
}
