-- seed.sql — D-Journey stages/requirements, networks/ministries, roles, skills, apps.
-- Fully idempotent: on conflict do nothing / do update on natural keys.

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
insert into public.roles (code, name) values
  ('member',        'Member'),
  ('network_head',  'Network Head'),
  ('ministry_head', 'Ministry Head'),
  ('pcm_staff',     'PCM Staff'),
  ('admin',         'Admin'),
  ('super_admin',   'Super Admin')
on conflict (code) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- apps
-- ---------------------------------------------------------------------------
insert into public.apps (code, name, base_url) values
  ('website',             'Public Website',        'https://jlycc.org'),
  ('member_portal',       'Member Portal',         'https://app.jlycc.org'),
  ('pcm_portal',          'PCM Portal',            'https://pcm.jlycc.org'),
  ('admin_portal',        'Admin Portal',          'https://admin.jlycc.org'),
  ('registration_portal', 'Registration Portal',   'https://registration.jlycc.org')
on conflict (code) do update set name = excluded.name, base_url = excluded.base_url;

-- ---------------------------------------------------------------------------
-- journey stages
-- ---------------------------------------------------------------------------
insert into public.journey_stages (code, name, tagline, sort_order) values
  ('GOOD_NEWS', 'Good News / Events', 'Reach the Lost',                          1),
  ('SAINT',     'Saint',              'Engage Christ and Community',             2),
  ('SHEEP',     'Sheep',              'Encourage Spiritual Discipline',          3),
  ('SON',       'Son',                'Establish Character and Faith',           4),
  ('SERVANT',   'Servant',            'Empower / Make Disciples',                5),
  ('SOJOURNER', 'Sojourner',          'Expand Nations and Sectors of Society',   6)
on conflict (code) do update
  set name = excluded.name, tagline = excluded.tagline, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- journey requirements
-- ---------------------------------------------------------------------------
with s as (select id, code from public.journey_stages)
insert into public.journey_requirements (stage_id, code, name, sort_order)
select s.id, r.code, r.name, r.sort_order
from (values
  -- Stage 1: Good News / Events
  ('GOOD_NEWS', 'HEARTLINK_C2S',          'HeartLink C2S',              1),
  ('GOOD_NEWS', 'SQUARE_ONE',             'Square One',                 2),
  ('GOOD_NEWS', 'ONE_MINUTE_WITNESS',     'One Minute Witness',         3),
  ('GOOD_NEWS', 'ONE_VERSE_EVANGELISM',   'One Verse Evangelism',       4),
  -- Stage 2: Saint
  ('SAINT',     'MY_FIRST_STEPS',         'My First Steps',             1),
  ('SAINT',     'TRANSFORMATION_WEEKEND', 'Transformation Weekend',     2),
  ('SAINT',     'WATER_BAPTISM',          'Water Baptism',              3),
  -- Stage 3: Sheep
  ('SHEEP',     'GREEN_BOOK_II',          'Green Book II Series',       1),
  ('SHEEP',     'A_CALL_TO_JOY',          'A Call to Joy',              2),
  ('SHEEP',     'SUNDAY_SERVICES',        'Sunday Services',            3),
  ('SHEEP',     'MINISTRY_GROUP',         'Ministry Group',             4),
  -- Stage 4: Son
  ('SON',       'YELLOW_BOOK_II',         'Yellow Book II Series',      1),
  ('SON',       'A_CALL_TO_GROWTH',       'A Call to Growth',           2),
  ('SON',       'CHOSEN_GENERATION',      'Chosen Generation',          3),
  ('SON',       'DLINK_MATRIX',           'D-Link Matrix',              4),
  ('SON',       'SHAPE',                  'Shape',                      5),
  ('SON',       'DISCOVERY_SUMMIT',       'Discovery Summit',           6),
  -- Stage 5: Servant
  ('SERVANT',   'BLUE_BOOK_II',           'Blue Book II Series',        1),
  ('SERVANT',   'PERSONAL_FOUNDATION',    'Personal Foundation',        2),
  ('SERVANT',   'BECOMING_DISCIPLE_MAKER','Becoming a Disciple Maker',  3),
  ('SERVANT',   'JOSHUA_GENERATION',      'Joshua Generation',          4),
  ('SERVANT',   'MEMBERSHIP_ORIENTATION', 'Membership Orientation',     5),
  ('SERVANT',   'DISCIPLERS_ACADEMY',     'Discipler''s Academy',       6),
  -- Stage 6: Sojourner
  ('SOJOURNER', 'PURPLE_BOOK_II',         'Purple Book II Series',      1),
  ('SOJOURNER', 'INNER_CIRCLE',           'Inner Circle',               2),
  ('SOJOURNER', 'COMMISSIONING',          'Commissioning',              3),
  ('SOJOURNER', 'ADVANCE_COURSES',        'Advance Courses',            4),
  ('SOJOURNER', 'SPECIALIZED_COURSES',    'Specialized Courses',        5)
) as r(stage_code, code, name, sort_order)
join s on s.code = r.stage_code
on conflict (code) do update
  set name = excluded.name, sort_order = excluded.sort_order, stage_id = excluded.stage_id;

-- ---------------------------------------------------------------------------
-- networks + ministries
-- ---------------------------------------------------------------------------
insert into public.networks (code, name) values
  ('EAGLES', 'EAGLES'),
  ('AMEN',   'AMEN'),
  ('WIND',   'WIND')
on conflict (code) do update set name = excluded.name;

with n as (select id, code from public.networks)
insert into public.ministries (network_id, code, name)
select n.id, m.code, m.name
from (values
  ('EAGLES', 'KINGDOM_KIDS',      'Kingdom Kids'),
  ('EAGLES', 'CCEM',              'CCEM'),
  ('EAGLES', 'BEST',              'Best'),
  ('AMEN',   'LEADTAKERS_YOUTH',  'Leadtakers Youth'),
  ('AMEN',   'LEADTAKERS_PRO',    'Leadtakers Pro'),
  ('AMEN',   'D818',              'D8:18'),
  ('WIND',   'MOVE',              'Move'),
  ('WIND',   'ZOOM',              'Zoom'),
  ('WIND',   'PRISM',             'Prism'),
  ('WIND',   'CREATIVES',         'Creatives'),
  ('WIND',   'ILLUMINATE',        'Illuminate'),
  ('WIND',   'GATE_KEEPERS',      'Gate Keepers'),
  ('WIND',   'FRONT_LINER',       'Front Liner'),
  ('WIND',   'SENTINEL',          'Sentinel'),
  ('WIND',   'DAVIDIC_SYMPHONIA', 'Davidic Symphonia')
) as m(network_code, code, name)
join n on n.code = m.network_code
on conflict (code) do update set name = excluded.name, network_id = excluded.network_id;

-- ---------------------------------------------------------------------------
-- skills (Member Information Card talents)
-- ---------------------------------------------------------------------------
insert into public.skills (code, name, category) values
  ('SINGING',         'Singing',         'performing'),
  ('DANCING',         'Dancing',         'performing'),
  ('TEACHING',        'Teaching',        'ministry'),
  ('COOKING',         'Cooking',         'service'),
  ('PREACHING',       'Preaching',       'ministry'),
  ('VISUAL_ARTS',     'Visual Arts',     'creative'),
  ('MULTIMEDIA_ARTS', 'Multimedia Arts', 'creative'),
  ('HOUSE_PAINTING',  'House Painting',  'service'),
  ('DRIVING',         'Driving',         'service')
on conflict (code) do update set name = excluded.name, category = excluded.category;
