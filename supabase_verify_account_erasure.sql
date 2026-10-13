-- READ ONLY: inspect the correct Weekwise project before enabling account erasure.
-- Core cloud data is required; absent optional tables must be confirmed unused.
with expected(name, required) as (values
 ('weekwise_cloud_data',true),('weekwise_push_subscriptions',false),
 ('weekwise_push_delivery_log',false),('weekwise_calendar_oauth_states',false),
 ('weekwise_calendar_connections',false),('weekwise_calendar_event_links',false)
)
select e.name,e.required,to_regclass('public.'||e.name) is not null as installed,
 exists(select 1 from pg_constraint c
  join pg_attribute child on child.attrelid=c.conrelid and child.attnum=c.conkey[1]
  join pg_attribute parent on parent.attrelid=c.confrelid and parent.attnum=c.confkey[1]
  where c.contype='f' and c.conrelid=to_regclass('public.'||e.name)
   and c.confrelid='auth.users'::regclass and c.convalidated and c.confdeltype='c'
   and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
   and child.attname='user_id' and parent.attname='id') as validated_owner_cascade
from expected e order by e.required desc,e.name;

-- Review every additional Auth-dependent table; hard delete can affect it too.
select c.conrelid::regclass as referring_table,c.conname,c.convalidated,
 pg_get_constraintdef(c.oid) as definition
from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass
order by c.conrelid::regclass::text,c.conname;
