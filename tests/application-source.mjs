import fs from 'node:fs';import vm from 'node:vm';
const directory=new URL('../js/',import.meta.url);
// Static guards scan every shipped controller. Context prefixes are normalized only for these scans.
export function readApplication(){return ['weekwise-app.js',...fs.readdirSync(directory).filter(name=>/^weekwise-app-.+\.js$/.test(name)).sort()].map(name=>fs.readFileSync(new URL(name,directory),'utf8')).join('\n').replace(/\bweekwiseRuntime\./g,'');}
// Behavior tests execute the real factory and retain independent service mocks.
export function exposeController(context,domain,names){const source=fs.readFileSync(new URL('weekwise-app-'+domain+'.js',directory),'utf8');vm.runInNewContext(source,context);const key='WeekwiseApp'+domain[0].toUpperCase()+domain.slice(1),factory=context.window?.[key]||context[key],api=factory.create(context);for(const name of names)context[name]=api[name];return api;}
