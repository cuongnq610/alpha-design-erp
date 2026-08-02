#!/usr/bin/env python3
import argparse, json, re
from pathlib import Path

root=Path(__file__).resolve().parent
release=json.loads(root.joinpath('VERSION.json').read_text(encoding='utf-8'))['version']
parser=argparse.ArgumentParser(description=f'Configure ALPHA DESIGN ERP Cloud v{release} runtime')
parser.add_argument('--url',required=True,help='Supabase Project URL')
parser.add_argument('--publishable-key','--anon-key',dest='publishable_key',required=True,help='Supabase publishable key (hoặc legacy anon key); không dùng secret/service-role key')
parser.add_argument('--environment',choices=['staging','production'],default='staging')
parser.add_argument('--api-base-url',default='')
parser.add_argument('--company-code',default='ALPHA')
parser.add_argument('--company-name',default='ALPHA DESIGN')
parser.add_argument('--owner-name',required=True)
parser.add_argument('--auto-provision',action='store_true',help='Only for first controlled staging bootstrap')
args=parser.parse_args()

url=args.url.rstrip('/')
if not url.startswith('https://') or '.supabase.co' not in url:
    raise SystemExit('Supabase URL không hợp lệ')
key=args.publishable_key.strip()
if len(key)<40:
    raise SystemExit('Publishable/anon key không hợp lệ')
if key.startswith(('sb_secret_','service_role')) or 'service_role' in key.lower():
    raise SystemExit('Không được đưa secret/service-role key vào trình duyệt')
if args.environment=='production' and args.auto_provision:
    raise SystemExit('Production không cho phép auto-provision. Hãy tạo membership/role qua quy trình quản trị được kiểm soát.')

config={
  'releaseVersion':release,
  'environment':args.environment,
  'dataMode':'server-authoritative',
  'apiBaseUrl':args.api_base_url.rstrip('/'),
  'requireServerForProduction':True,
  'apiAuthRequired':True,
  'allowDemoLogin':False,
  'allowLocalBusinessData':False,
  'allowOfflineWritesInProduction':False,
  'sessionPersistence':'session',
  'sessionIdleTimeoutMs':1800000,
  'sessionAbsoluteTimeoutMs':28800000,
  'requireMfaForPrivilegedRoles':True,
  'supabaseUrl':url,
  'supabaseAnonKey':key,
  'companyCode':re.sub(r'[^A-Z0-9_-]','',args.company_code.upper()),
  'companyName':args.company_name.strip(),
  'ownerFullName':args.owner_name.strip(),
  'autoProvisionFirstUser':bool(args.auto_provision),
  'enableRealtime':True,
  'syncIntervalMs':10000,
  'bootstrapDemoData':False
}
text=f'// Generated locally for ALPHA DESIGN ERP Cloud v{release}. Never put service-role/secret keys here.\nwindow.ALPHA_RUNTIME_CONFIG = '+json.dumps(config,ensure_ascii=False,indent=2)+';\n'
root.joinpath('runtime-config.js').write_text(text,encoding='utf-8')
public=root/'public'
if public.exists():
    public.joinpath('runtime-config.js').write_text(text,encoding='utf-8')
print(f'Đã cập nhật runtime-config.js cho {args.environment.upper()} (root và public nếu có)')
