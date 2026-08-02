#!/usr/bin/env node
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));
const key=process.argv[2]||'version';
if(!(key in version)){console.error(`Unknown VERSION.json key: ${key}`);process.exit(2);}
process.stdout.write(String(version[key]));
