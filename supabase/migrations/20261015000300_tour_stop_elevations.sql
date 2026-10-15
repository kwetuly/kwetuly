-- Corrected map positions (checked against terrain data) and approximate stop altitudes read
-- from the open Terrain Tiles dataset (Mapzen / AWS Open Data, built from USGS SRTM and
-- GMTED2010). Uhuru Peak uses the official TANAPA figure (Kibo 5,895 m).
update public.trip_stops set lat = -3.2600, lng = 35.5800 where name in ('Ngorongoro Crater rim', 'Ngorongoro highlands');
update public.trip_stops set lat = -3.1750, lng = 35.5650 where name = 'Ngorongoro Crater';
update public.trip_stops set lat = -3.2445, lng = 36.7500 where name = 'Socialist Peak';
update public.trip_stops set lat = -6.1000, lng = 29.7400 where name = 'Mahale Mountains National Park';

update public.trip_stops s set elevation_m = v.e from (values
  (-3.3349, 37.3404, 879),
  (-3.2560, 37.3850, 1518),
  (-3.4400, 37.1900, 843),
  (-3.2410, 37.5190, 1881),
  (-6.7924, 39.2083, 59),
  (-7.3000, 37.1000, 495),
  (-6.1630, 39.1890, 15),
  (-6.1000, 39.2500, 60),
  (-6.1300, 39.1500, 0),
  (-3.3869, 36.6830, 1359),
  (-2.4333, 34.8167, 1499),
  (-3.2600, 35.5800, 2131),
  (-3.1750, 35.5650, 1740),
  (-3.9500, 36.0500, 1180),
  (-3.5500, 35.8000, 954),
  (-3.0000, 34.9900, 1588),
  (-3.2200, 36.8700, 1525),
  (-3.1700, 37.2440, 1860),
  (-3.1250, 37.2700, 2589),
  (-3.0870, 37.2480, 2991),
  (-3.0950, 37.3220, 4053),
  (-3.0980, 37.3600, 4468),
  (-3.0980, 37.3740, 4580),
  (-3.0758, 37.3533, 5866),
  (-3.2230, 37.3360, 1560),
  (-3.0600, 37.0300, 1380),
  (-3.0500, 37.1700, 2643),
  (-3.0300, 37.2100, 3767),
  (-3.0500, 37.2500, 3676),
  (-3.2050, 37.5250, 2317),
  (-3.1270, 37.4700, 3903),
  (-3.0850, 37.4000, 4517),
  (-3.2330, 36.8000, 2412),
  (-3.2400, 36.7700, 3163),
  (-3.2445, 36.7500, 4510),
  (-2.3500, 35.9100, 640),
  (-2.7640, 35.9140, 2921),
  (-3.3550, 35.8550, 976),
  (-3.3400, 35.6700, 1541),
  (-3.5800, 35.3500, 1132),
  (-3.2700, 37.5200, 1548),
  (-7.8000, 38.1000, 65),
  (-7.7700, 35.6900, 1591),
  (-7.7300, 34.9300, 858),
  (-3.3677, 36.6334, 1391),
  (-6.1000, 29.7400, 923),
  (-6.2220, 39.2249, 14),
  (-5.8700, 39.3600, 0),
  (-5.8200, 39.3800, 0),
  (-6.4430, 38.9040, 14),
  (-8.9200, 39.5100, 19),
  (-8.9600, 39.5100, 12)
) as v (lat, lng, e) where s.lat = v.lat and s.lng = v.lng;

update public.trip_stops set elevation_m = 5895 where name in ('Uhuru Peak', 'Kilimanjaro (Uhuru Peak)');
